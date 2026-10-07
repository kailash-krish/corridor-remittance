/**
 * chainServiceAdapter.ts
 *
 * Bridge adapter between Person 3's Hardhat ChainService and
 * Person 2's transferOrchestrator legacy ChainService interface.
 */

import { ChainService } from "./chainService";

export interface LegacyChainConversionResult {
  txHash: string;
  sourceAmountMinor: number;
  fromCurrency: string;
  toCurrency: string;
  blockNumber: number;
  timestamp: string;
}

export class CoreBackendChainAdapter {
  private chainService: ChainService;

  constructor(chainService?: ChainService) {
    this.chainService = chainService || new ChainService();
  }

  public async mintStablecoin(userId: string, amountMinor: number, currency: string): Promise<string> {
    const pseudoTransferId = `mint-${userId}-${Date.now()}`;
    const receipt = await this.chainService.mintStable(pseudoTransferId, userId, amountMinor);
    return receipt.txHash;
  }

  public async convert(
    transferId: string,
    amountMinor: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<LegacyChainConversionResult> {
    // In Person 3's escrow architecture, convert is represented by locking into escrow
    // for the transfer recipient
    const receipt = await this.chainService.lockForTransfer(
      transferId,
      "sender-default",
      "receiver-default",
      amountMinor
    );

    return {
      txHash: receipt.txHash,
      sourceAmountMinor: amountMinor,
      fromCurrency,
      toCurrency,
      blockNumber: receipt.blockNumber,
      timestamp: new Date().toISOString(),
    };
  }

  public async burnStablecoin(userId: string, amountMinor: number, currency: string): Promise<string> {
    const pseudoTransferId = `burn-${userId}-${Date.now()}`;
    const receipt = await this.chainService.burnStable(pseudoTransferId, userId, amountMinor);
    return receipt.txHash;
  }
}
