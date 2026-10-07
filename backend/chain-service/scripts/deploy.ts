import { ethers } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

export interface DeploymentAddresses {
  tokenAddress: string;
  escrowAddress: string;
  adminAddress: string;
  deployedAt: string;
  network: string;
}

export async function deployContracts(): Promise<DeploymentAddresses> {
  const [deployer] = await ethers.getSigners();
  console.log(`🚀 Deploying contracts with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // 1. Deploy Stablecoin (RMTS)
  console.log("Deploying RemittanceStable (RMTS)...");
  const RemittanceStableFactory = await ethers.getContractFactory("RemittanceStable");
  const stableToken = await RemittanceStableFactory.deploy(deployer.address);
  await stableToken.waitForDeployment();
  const tokenAddress = await stableToken.getAddress();
  console.log(`✅ RemittanceStable deployed to: ${tokenAddress}`);

  // 2. Deploy RemittanceEscrow
  console.log("Deploying RemittanceEscrow...");
  const RemittanceEscrowFactory = await ethers.getContractFactory("RemittanceEscrow");
  const escrow = await RemittanceEscrowFactory.deploy(deployer.address, tokenAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`✅ RemittanceEscrow deployed to: ${escrowAddress}`);

  // Record deployment addresses
  const networkName = (await ethers.provider.getNetwork()).name;
  const deployment: DeploymentAddresses = {
    tokenAddress,
    escrowAddress,
    adminAddress: deployer.address,
    deployedAt: new Date().toISOString(),
    network: networkName,
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = path.join(deploymentsDir, `deployment-${networkName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2), "utf-8");
  // Also write default deployment.json for local/test access
  fs.writeFileSync(path.join(deploymentsDir, "deployment.json"), JSON.stringify(deployment, null, 2), "utf-8");

  console.log(`📄 Deployment addresses saved to ${filePath}`);
  return deployment;
}

async function main() {
  try {
    await deployContracts();
    process.exit(0);
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
