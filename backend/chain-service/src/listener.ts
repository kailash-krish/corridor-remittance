import { ethers } from "ethers";
import crypto from "node:crypto";
import axios from "axios";
import { config } from "./config";
import { db } from "./database";
import { REMITTANCE_ESCROW_ABI, REMITTANCE_STABLE_ABI } from "./abis";

export interface WebhookPayload {
  event: string;
  transferId: string;
  txHash: string;
  blockNumber: number;
  data: Record<string, unknown>;
  timestamp: string;
}

export class ChainEventListener {
  private provider: ethers.JsonRpcProvider;
  private escrowContract: ethers.Contract;
  private tokenContract: ethers.Contract;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(tokenAddress?: string, escrowAddress?: string) {
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);

    const tokAddr =
      tokenAddress ||
      process.env.TOKEN_ADDRESS ||
      "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const escAddr =
      escrowAddress ||
      process.env.ESCROW_ADDRESS ||
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    this.tokenContract = new ethers.Contract(
      tokAddr,
      REMITTANCE_STABLE_ABI,
      this.provider
    );
    this.escrowContract = new ethers.Contract(
      escAddr,
      REMITTANCE_ESCROW_ABI,
      this.provider
    );
  }

  /**
   * Generates HMAC-SHA256 signature for outgoing webhook payload
   */
  public generateHmac(payload: WebhookPayload): string {
    const raw = JSON.stringify(payload);
    return crypto
      .createHmac("sha256", config.WEBHOOK_HMAC_SECRET)
      .update(raw)
      .digest("hex");
  }

  /**
   * Posts signed webhook event to the core backend
   */
  public async dispatchWebhook(payload: WebhookPayload): Promise<void> {
    const signature = this.generateHmac(payload);
    const endpoint = `${config.CORE_BACKEND_URL}/webhooks/chain`;

    try {
      await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Chain-Signature": signature,
        },
        timeout: 5000,
      });
      console.log(`[EventListener] Webhook sent for ${payload.event}: ${payload.transferId}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[EventListener] Webhook delivery failed for ${payload.transferId}: ${errorMsg}`);
    }
  }

  /**
   * Scans a range of blocks for contract events
   */
  public async pollEvents(fromBlock: number, toBlock: number): Promise<void> {
    if (fromBlock > toBlock) return;

    // 1. Escrow events
    const lockedFilter = this.escrowContract.filters.Locked();
    const lockedLogs = await this.escrowContract.queryFilter(lockedFilter, fromBlock, toBlock);
    for (const log of lockedLogs) {
      if ("args" in log) {
        const [transferKey, transferId, sender, receiver, amount] = log.args;
        await this.dispatchWebhook({
          event: "ESCROW_LOCKED",
          transferId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          data: { transferKey, sender, receiver, amount: amount.toString() },
          timestamp: new Date().toISOString(),
        });
      }
    }

    const releasedFilter = this.escrowContract.filters.Released();
    const releasedLogs = await this.escrowContract.queryFilter(releasedFilter, fromBlock, toBlock);
    for (const log of releasedLogs) {
      if ("args" in log) {
        const [transferKey, transferId, receiver, amount] = log.args;
        await this.dispatchWebhook({
          event: "ESCROW_RELEASED",
          transferId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          data: { transferKey, receiver, amount: amount.toString() },
          timestamp: new Date().toISOString(),
        });
      }
    }

    const refundedFilter = this.escrowContract.filters.Refunded();
    const refundedLogs = await this.escrowContract.queryFilter(refundedFilter, fromBlock, toBlock);
    for (const log of refundedLogs) {
      if ("args" in log) {
        const [transferKey, transferId, sender, amount] = log.args;
        await this.dispatchWebhook({
          event: "ESCROW_REFUNDED",
          transferId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          data: { transferKey, sender, amount: amount.toString() },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Token Minted / Burned events
    const mintedFilter = this.tokenContract.filters.Minted();
    const mintedLogs = await this.tokenContract.queryFilter(mintedFilter, fromBlock, toBlock);
    for (const log of mintedLogs) {
      if ("args" in log) {
        const [to, amount, transferId] = log.args;
        await this.dispatchWebhook({
          event: "TOKEN_MINTED",
          transferId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          data: { to, amount: amount.toString() },
          timestamp: new Date().toISOString(),
        });
      }
    }

    const burnedFilter = this.tokenContract.filters.Burned();
    const burnedLogs = await this.tokenContract.queryFilter(burnedFilter, fromBlock, toBlock);
    for (const log of burnedLogs) {
      if ("args" in log) {
        const [from, amount, transferId] = log.args;
        await this.dispatchWebhook({
          event: "TOKEN_BURNED",
          transferId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          data: { from, amount: amount.toString() },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Starts periodic polling loop
   */
  public async start(): Promise<void> {
    this.isRunning = true;
    console.log("[EventListener] Started polling for blockchain events...");

    const tick = async () => {
      if (!this.isRunning) return;
      try {
        const currentBlock = await this.provider.getBlockNumber();
        const lastBlockStr = await db.listenerState.get("lastBlock");
        const fromBlock = lastBlockStr ? parseInt(lastBlockStr, 10) + 1 : currentBlock;

        if (fromBlock <= currentBlock) {
          await this.pollEvents(fromBlock, currentBlock);
          await db.listenerState.set("lastBlock", currentBlock.toString());
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[EventListener] Error polling events:", errorMsg);
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(tick, config.EVENT_POLL_INTERVAL_MS);
        }
      }
    };

    await tick();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("[EventListener] Stopped.");
  }
}

// Standalone runner
if (require.main === module) {
  const listener = new ChainEventListener();
  listener.start();

  process.on("SIGINT", () => {
    listener.stop();
    process.exit(0);
  });
}
