import { ethers } from "ethers";
import {
  ChainReceipt,
  ChainServiceInterface,
} from "./chainService.interface";
import { WalletService } from "./walletService";
import { minorUnitsToTokenUnits } from "./conversion";
import { db } from "./database";
import { config } from "./config";
import { REMITTANCE_STABLE_ABI, REMITTANCE_ESCROW_ABI } from "./abis";

export interface ChainServiceOptions {
  provider?: ethers.Provider;
  adminSigner?: ethers.Signer;
  tokenAddress?: string;
  escrowAddress?: string;
}

export class ChainService implements ChainServiceInterface {
  private provider: ethers.Provider;
  private adminSigner: ethers.Signer;
  private walletService: WalletService;
  private tokenContract: ethers.Contract;
  private escrowContract: ethers.Contract;
  private tokenAddress: string;
  private escrowAddress: string;

  constructor(options?: ChainServiceOptions) {
    this.provider =
      options?.provider ||
      new ethers.JsonRpcProvider(config.RPC_URL);

    this.adminSigner =
      options?.adminSigner ||
      new ethers.Wallet(config.ADMIN_PRIVATE_KEY, this.provider);

    this.tokenAddress =
      options?.tokenAddress ||
      process.env.TOKEN_ADDRESS ||
      "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    this.escrowAddress =
      options?.escrowAddress ||
      process.env.ESCROW_ADDRESS ||
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    this.walletService = new WalletService();

    this.tokenContract = new ethers.Contract(
      this.tokenAddress,
      REMITTANCE_STABLE_ABI,
      this.adminSigner
    );

    this.escrowContract = new ethers.Contract(
      this.escrowAddress,
      REMITTANCE_ESCROW_ABI,
      this.adminSigner
    );
  }

  /**
   * Helper to ensure a custodial wallet has sufficient ETH for gas.
   */
  private async ensureGas(address: string, minEth = ethers.parseEther("0.005")): Promise<void> {
    try {
      const balance = await this.provider.getBalance(address);
      if (balance < minEth) {
        const topUpAmount = ethers.parseEther("0.01");
        const tx = await this.adminSigner.sendTransaction({
          to: address,
          value: topUpAmount,
        });
        await tx.wait(1);
      }
    } catch {
      // In tests or mock providers where sendTransaction might not be supported, ignore
    }
  }

  /**
   * Step A: Mint stablecoins to sender's custodial wallet.
   */
  async mintStable(
    transferId: string,
    senderUserId: string,
    amountMinor: number
  ): Promise<ChainReceipt> {
    const cached = await db.chainTxs.find(transferId, "mintStable");
    if (cached) {
      return {
        txHash: cached.tx_hash,
        blockNumber: 0,
        gasUsed: "0",
      };
    }

    const senderWallet = await this.walletService.getOrCreateWallet(senderUserId);
    const tokenUnits = minorUnitsToTokenUnits(amountMinor);

    const tx = await this.tokenContract.mint(
      senderWallet.address,
      tokenUnits,
      transferId
    );
    const receipt = await tx.wait(config.CONFIRMATIONS_REQUIRED);

    const chainReceipt: ChainReceipt = {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };

    await db.chainTxs.save({
      transfer_id: transferId,
      method: "mintStable",
      tx_hash: receipt.hash,
      created_at: new Date().toISOString(),
    });

    return chainReceipt;
  }

  /**
   * Step B: Approve and lock stablecoins into escrow for transfer.
   */
  async lockForTransfer(
    transferId: string,
    senderUserId: string,
    receiverUserId: string,
    amountMinor: number
  ): Promise<ChainReceipt> {
    const cached = await db.chainTxs.find(transferId, "lockForTransfer");
    if (cached) {
      return {
        txHash: cached.tx_hash,
        blockNumber: 0,
        gasUsed: "0",
      };
    }

    const senderInfo = await this.walletService.getOrCreateWallet(senderUserId);
    const receiverInfo = await this.walletService.getOrCreateWallet(receiverUserId);
    const tokenUnits = minorUnitsToTokenUnits(amountMinor);

    // Fund sender with gas if needed
    await this.ensureGas(senderInfo.address);

    // Sender custodial wallet signer approves escrow
    const senderSigner = await this.walletService.getSignerForUser(
      senderUserId,
      this.provider
    );
    const senderToken = this.tokenContract.connect(senderSigner) as ethers.Contract;

    const approveTx = await senderToken.approve(this.escrowAddress, tokenUnits);
    await approveTx.wait(1);

    // Operator locks funds into escrow
    const lockTx = await this.escrowContract.lock(
      transferId,
      senderInfo.address,
      receiverInfo.address,
      tokenUnits
    );
    const receipt = await lockTx.wait(config.CONFIRMATIONS_REQUIRED);

    const chainReceipt: ChainReceipt = {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };

    await db.chainTxs.save({
      transfer_id: transferId,
      method: "lockForTransfer",
      tx_hash: receipt.hash,
      created_at: new Date().toISOString(),
    });

    return chainReceipt;
  }

  /**
   * Step C: Release escrowed funds to receiver custodial wallet.
   */
  async releaseToReceiver(transferId: string): Promise<ChainReceipt> {
    const cached = await db.chainTxs.find(transferId, "releaseToReceiver");
    if (cached) {
      return {
        txHash: cached.tx_hash,
        blockNumber: 0,
        gasUsed: "0",
      };
    }

    const tx = await this.escrowContract.release(transferId);
    const receipt = await tx.wait(config.CONFIRMATIONS_REQUIRED);

    const chainReceipt: ChainReceipt = {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };

    await db.chainTxs.save({
      transfer_id: transferId,
      method: "releaseToReceiver",
      tx_hash: receipt.hash,
      created_at: new Date().toISOString(),
    });

    return chainReceipt;
  }

  /**
   * Step D: Burn stablecoins from receiver custodial wallet.
   */
  async burnStable(
    transferId: string,
    receiverUserId: string,
    amountMinor: number
  ): Promise<ChainReceipt> {
    const cached = await db.chainTxs.find(transferId, "burnStable");
    if (cached) {
      return {
        txHash: cached.tx_hash,
        blockNumber: 0,
        gasUsed: "0",
      };
    }

    const receiverInfo = await this.walletService.getOrCreateWallet(receiverUserId);
    const tokenUnits = minorUnitsToTokenUnits(amountMinor);

    const tx = await this.tokenContract.burnFrom(
      receiverInfo.address,
      tokenUnits,
      transferId
    );
    const receipt = await tx.wait(config.CONFIRMATIONS_REQUIRED);

    const chainReceipt: ChainReceipt = {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };

    await db.chainTxs.save({
      transfer_id: transferId,
      method: "burnStable",
      tx_hash: receipt.hash,
      created_at: new Date().toISOString(),
    });

    return chainReceipt;
  }

  /**
   * Step E: Refund escrowed funds back to sender.
   */
  async refund(transferId: string): Promise<ChainReceipt> {
    const cached = await db.chainTxs.find(transferId, "refund");
    if (cached) {
      return {
        txHash: cached.tx_hash,
        blockNumber: 0,
        gasUsed: "0",
      };
    }

    const tx = await this.escrowContract.refund(transferId);
    const receipt = await tx.wait(config.CONFIRMATIONS_REQUIRED);

    const chainReceipt: ChainReceipt = {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };

    await db.chainTxs.save({
      transfer_id: transferId,
      method: "refund",
      tx_hash: receipt.hash,
      created_at: new Date().toISOString(),
    });

    return chainReceipt;
  }

  /**
   * Query escrow state: 0=NONE, 1=LOCKED, 2=RELEASED, 3=REFUNDED
   */
  async getEscrowState(transferId: string): Promise<number> {
    const state = await this.escrowContract.getState(transferId);
    return Number(state);
  }

  /**
   * Get or create custodial wallet for a user.
   */
  async getOrCreateWallet(userId: string): Promise<{ address: string }> {
    const wallet = await this.walletService.getOrCreateWallet(userId);
    return { address: wallet.address };
  }
}
