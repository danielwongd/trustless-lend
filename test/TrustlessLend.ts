import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import {
  ConfidentialUSDT,
  ConfidentialUSDT__factory,
  TrustlessLend,
  TrustlessLend__factory,
} from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const cusdtFactory = (await ethers.getContractFactory("ConfidentialUSDT")) as ConfidentialUSDT__factory;
  const cusdt = (await cusdtFactory.deploy()) as ConfidentialUSDT;
  const cusdtAddress = await cusdt.getAddress();

  const lendFactory = (await ethers.getContractFactory("TrustlessLend")) as TrustlessLend__factory;
  const lend = (await lendFactory.deploy(cusdtAddress)) as TrustlessLend;
  const lendAddress = await lend.getAddress();

  await cusdt.setMinter(lendAddress);

  return { cusdt, cusdtAddress, lend, lendAddress };
}

describe("TrustlessLend", function () {
  let signers: Signers;
  let cusdt: ConfidentialUSDT;
  let cusdtAddress: string;
  let lend: TrustlessLend;
  let lendAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ cusdt, cusdtAddress, lend, lendAddress } = await deployFixture());
  });

  it("stakes ETH and decrypts the encrypted stake", async function () {
    const stakeAmount = ethers.parseEther("1.0");

    await lend.connect(signers.alice).stake({ value: stakeAmount });

    const encryptedStake = await lend.encryptedStakeOf(signers.alice.address);
    const decryptedStake = await fhevm.userDecryptEuint(
      FhevmType.euint128,
      encryptedStake,
      lendAddress,
      signers.alice,
    );

    const plainStake = await lend.stakeOf(signers.alice.address);

    expect(decryptedStake).to.eq(stakeAmount);
    expect(plainStake).to.eq(stakeAmount);
  });

  it("borrows and repays cUSDT with encrypted amounts", async function () {
    await lend.connect(signers.alice).stake({ value: ethers.parseEther("1.0") });

    const borrowAmount = ethers.parseUnits("250", 6);
    const encryptedBorrow = await fhevm
      .createEncryptedInput(lendAddress, signers.alice.address)
      .add64(borrowAmount)
      .encrypt();

    await lend.connect(signers.alice).borrow(encryptedBorrow.handles[0], encryptedBorrow.inputProof);

    const encryptedDebt = await lend.encryptedDebtOf(signers.alice.address);
    const decryptedDebt = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedDebt,
      lendAddress,
      signers.alice,
    );

    const encryptedBalance = await cusdt.confidentialBalanceOf(signers.alice.address);
    const decryptedBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      cusdtAddress,
      signers.alice,
    );

    expect(decryptedDebt).to.eq(borrowAmount);
    expect(decryptedBalance).to.eq(borrowAmount);

    const encryptedRepay = await fhevm
      .createEncryptedInput(lendAddress, signers.alice.address)
      .add64(borrowAmount)
      .encrypt();

    await lend.connect(signers.alice).repay(encryptedRepay.handles[0], encryptedRepay.inputProof);

    const encryptedDebtAfter = await lend.encryptedDebtOf(signers.alice.address);
    const decryptedDebtAfter = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedDebtAfter,
      lendAddress,
      signers.alice,
    );

    const encryptedBalanceAfter = await cusdt.confidentialBalanceOf(signers.alice.address);
    const decryptedBalanceAfter = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalanceAfter,
      cusdtAddress,
      signers.alice,
    );

    expect(decryptedDebtAfter).to.eq(0);
    expect(decryptedBalanceAfter).to.eq(0);
  });

  it("withdraws ETH and updates encrypted stake", async function () {
    const stakeAmount = ethers.parseEther("1.0");
    const withdrawAmount = ethers.parseEther("0.4");

    await lend.connect(signers.alice).stake({ value: stakeAmount });
    await lend.connect(signers.alice).withdraw(withdrawAmount);

    const plainStake = await lend.stakeOf(signers.alice.address);
    expect(plainStake).to.eq(stakeAmount - withdrawAmount);

    const encryptedStake = await lend.encryptedStakeOf(signers.alice.address);
    const decryptedStake = await fhevm.userDecryptEuint(
      FhevmType.euint128,
      encryptedStake,
      lendAddress,
      signers.alice,
    );

    expect(decryptedStake).to.eq(stakeAmount - withdrawAmount);
  });
});
