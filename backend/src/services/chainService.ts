import crypto from "node:crypto";
import { logger } from "../utils/logger.js";

export interface ChainConversionResult {
  txHash: string;
  sourceAmountMinor: number;
  fromCurrency: string;
  toCurrency: string;
  blockNumber: number;
  timestamp: string;
}

/**
 * Interface contract for on-chain stablecoin minting, cross-currency swap, and burning.
 * Designed as a clean stub so Person 3 (Blockchain / Smart Contract lead) can swap
 * with ethers.js / web3.js / viem implementation without altering the core brain orchestrator.
 */
export interface ChainService {
  mintStablecoin(userId: string, amountMinor: number, currency: string): Promise<string>;
  convert(
    transferId: string,
    amountMinor: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ChainConversionResult>;
  burnStablecoin(userId: string, amountMinor: number, currency: string): Promise<string>;
}

/**
 * Simulated in-memory blockchain service producing realistic transaction hashes and blocks
 */
export class MockChainService implements ChainService {
  private blockHeight = 18_450_200;

  public async mintStablecoin(
    userId: string,
    amountMinor: number,
    currency: string
  ): Promise<string> {
    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;
    this.blockHeight += 1;
    logger.info(
      { userId, amountMinor, currency, txHash, blockNumber: this.blockHeight },
      "Simulated on-chain stablecoin mint"
    );
    return txHash;
  }

  public async convert(
    transferId: string,
    amountMinor: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ChainConversionResult> {
    // Simulate brief block confirmation latency
    await new Promise((resolve) => setTimeout(resolve, 30));

    this.blockHeight += 1;
    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;

    logger.info(
      {
        transferId,
        amountMinor,
        fromCurrency,
        toCurrency,
        txHash,
        blockNumber: this.blockHeight
      },
      "Simulated on-chain cross-border stablecoin swap / liquidity pool conversion"
    );

    return {
      txHash,
      sourceAmountMinor: amountMinor,
      fromCurrency,
      toCurrency,
      blockNumber: this.blockHeight,
      timestamp: new Date().toISOString()
    };
  }

  public async burnStablecoin(
    userId: string,
    amountMinor: number,
    currency: string
  ): Promise<string> {
    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;
    this.blockHeight += 1;
    logger.info(
      { userId, amountMinor, currency, txHash, blockNumber: this.blockHeight },
      "Simulated on-chain stablecoin burn upon fiat settlement"
    );
    return txHash;
  }
}

export const mockChainService = new MockChainService();
