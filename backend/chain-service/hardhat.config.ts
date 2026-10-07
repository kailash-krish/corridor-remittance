import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const ADMIN_PRIVATE_KEY =
  process.env.ADMIN_PRIVATE_KEY ||
  // Hardhat built-in test account #0 — never use in production
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    // Local Hardhat dev node
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      chainId: 31337
    },
    // Sepolia testnet (optional)
    sepolia: {
      url: process.env.RPC_URL || "",
      accounts: [ADMIN_PRIVATE_KEY],
      chainId: 11155111
    },
    // Polygon Amoy testnet (optional)
    amoy: {
      url: process.env.RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: [ADMIN_PRIVATE_KEY],
      chainId: 80002
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    artifacts: "./artifacts",
    cache: "./cache"
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  }
};

export default config;
