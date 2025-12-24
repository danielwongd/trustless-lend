// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {euint64} from "@fhevm/solidity/lib/FHE.sol";

contract ConfidentialUSDT is ERC7984, ZamaEthereumConfig {
    address public owner;
    address public minter;

    event MinterUpdated(address indexed previousMinter, address indexed newMinter);

    error InvalidMinter();
    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyMinter() {
        if (msg.sender != minter) {
            revert Unauthorized();
        }
        _;
    }

    constructor() ERC7984("cUSDT", "cUSDT", "") {
        owner = msg.sender;
        minter = msg.sender;
    }

    function setMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) {
            revert InvalidMinter();
        }

        address previousMinter = minter;
        minter = newMinter;
        emit MinterUpdated(previousMinter, newMinter);
    }

    function mint(address to, euint64 amount) external onlyMinter returns (euint64) {
        return _mint(to, amount);
    }

    function burn(address from, euint64 amount) external onlyMinter returns (euint64) {
        return _burn(from, amount);
    }
}
