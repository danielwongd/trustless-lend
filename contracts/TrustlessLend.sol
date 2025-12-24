// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, euint128, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHESafeMath} from "@openzeppelin/confidential-contracts/utils/FHESafeMath.sol";
import {ConfidentialUSDT} from "./ConfidentialUSDT.sol";

contract TrustlessLend is ZamaEthereumConfig {
    ConfidentialUSDT public immutable stablecoin;

    mapping(address => euint128) private _encryptedStake;
    mapping(address => euint64) private _encryptedDebt;
    mapping(address => uint256) private _plainStake;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, euint64 amount);
    event Repaid(address indexed user, euint64 amount);

    error InvalidAmount();
    error InvalidStablecoin();
    error InsufficientStake();
    error MissingCollateral();
    error EthTransferFailed();

    constructor(address stablecoinAddress) {
        if (stablecoinAddress == address(0)) {
            revert InvalidStablecoin();
        }
        stablecoin = ConfidentialUSDT(stablecoinAddress);
    }

    function stake() external payable {
        if (msg.value == 0 || msg.value > type(uint128).max) {
            revert InvalidAmount();
        }

        _plainStake[msg.sender] += msg.value;

        euint128 encryptedAmount = FHE.asEuint128(uint128(msg.value));
        (, euint128 updatedStake) = _tryIncreaseEuint128(_encryptedStake[msg.sender], encryptedAmount);
        _encryptedStake[msg.sender] = updatedStake;

        FHE.allowThis(updatedStake);
        FHE.allow(updatedStake, msg.sender);

        emit Staked(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0 || amount > type(uint128).max) {
            revert InvalidAmount();
        }

        uint256 currentStake = _plainStake[msg.sender];
        if (currentStake < amount) {
            revert InsufficientStake();
        }

        _plainStake[msg.sender] = currentStake - amount;

        euint128 encryptedAmount = FHE.asEuint128(uint128(amount));
        (, euint128 updatedStake) = _tryDecreaseEuint128(_encryptedStake[msg.sender], encryptedAmount);
        _encryptedStake[msg.sender] = updatedStake;

        FHE.allowThis(updatedStake);
        FHE.allow(updatedStake, msg.sender);

        (bool sent, ) = msg.sender.call{value: amount}("");
        if (!sent) {
            revert EthTransferFailed();
        }

        emit Withdrawn(msg.sender, amount);
    }

    function borrow(externalEuint64 amount, bytes calldata inputProof) external {
        if (_plainStake[msg.sender] == 0) {
            revert MissingCollateral();
        }

        euint64 encryptedAmount = FHE.fromExternal(amount, inputProof);
        (, euint64 updatedDebt) = FHESafeMath.tryIncrease(_encryptedDebt[msg.sender], encryptedAmount);
        _encryptedDebt[msg.sender] = updatedDebt;

        FHE.allowThis(updatedDebt);
        FHE.allow(updatedDebt, msg.sender);

        FHE.allow(encryptedAmount, address(stablecoin));
        stablecoin.mint(msg.sender, encryptedAmount);

        emit Borrowed(msg.sender, encryptedAmount);
    }

    function repay(externalEuint64 amount, bytes calldata inputProof) external {
        euint64 encryptedAmount = FHE.fromExternal(amount, inputProof);
        (ebool success, euint64 updatedDebt) = FHESafeMath.tryDecrease(_encryptedDebt[msg.sender], encryptedAmount);
        euint64 actualRepaid = FHE.select(success, encryptedAmount, FHE.asEuint64(0));
        _encryptedDebt[msg.sender] = updatedDebt;

        FHE.allowThis(updatedDebt);
        FHE.allow(updatedDebt, msg.sender);

        FHE.allow(actualRepaid, address(stablecoin));
        stablecoin.burn(msg.sender, actualRepaid);

        emit Repaid(msg.sender, actualRepaid);
    }

    function encryptedStakeOf(address user) external view returns (euint128) {
        return _encryptedStake[user];
    }

    function encryptedDebtOf(address user) external view returns (euint64) {
        return _encryptedDebt[user];
    }

    function stakeOf(address user) external view returns (uint256) {
        return _plainStake[user];
    }

    function _tryIncreaseEuint128(
        euint128 oldValue,
        euint128 delta
    ) internal returns (ebool success, euint128 updated) {
        if (!FHE.isInitialized(oldValue)) {
            return (FHE.asEbool(true), delta);
        }
        euint128 newValue = FHE.add(oldValue, delta);
        success = FHE.ge(newValue, oldValue);
        updated = FHE.select(success, newValue, oldValue);
    }

    function _tryDecreaseEuint128(
        euint128 oldValue,
        euint128 delta
    ) internal returns (ebool success, euint128 updated) {
        if (!FHE.isInitialized(oldValue)) {
            if (!FHE.isInitialized(delta)) {
                return (FHE.asEbool(true), oldValue);
            }
            return (FHE.eq(delta, 0), FHE.asEuint128(0));
        }
        success = FHE.ge(oldValue, delta);
        updated = FHE.select(success, FHE.sub(oldValue, delta), oldValue);
    }
}
