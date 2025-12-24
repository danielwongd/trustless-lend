import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const { ethers } = hre;

  const deployedCUSDT = await deploy("ConfidentialUSDT", {
    from: deployer,
    log: true,
  });

  const deployedTrustlessLend = await deploy("TrustlessLend", {
    from: deployer,
    args: [deployedCUSDT.address],
    log: true,
  });

  const signer = await ethers.getSigner(deployer);
  const cusdtContract = await ethers.getContractAt("ConfidentialUSDT", deployedCUSDT.address, signer);
  const currentMinter = await cusdtContract.minter();
  if (currentMinter.toLowerCase() !== deployedTrustlessLend.address.toLowerCase()) {
    const tx = await cusdtContract.setMinter(deployedTrustlessLend.address);
    await tx.wait();
  }

  console.log(`ConfidentialUSDT contract: `, deployedCUSDT.address);
  console.log(`TrustlessLend contract: `, deployedTrustlessLend.address);
};
export default func;
func.id = "deploy_trustless_lend"; // id required to prevent reexecution
func.tags = ["TrustlessLend"];
