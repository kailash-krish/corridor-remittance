/**
 * chainService.interface.ts
 *
 * CONTRACT with Person 2 (core backend / orchestrator).
 * This file is the source of truth — do NOT change method signatures
 * without coordinating with Person 2.
 *
 * Every call takes transferId to enable on-chain idempotency.
 * Every call returns a ChainReceipt for the backend to store.
 */

export interface ChainReceipt {
  txHash:      string;  // Ethereum transaction hash (0x...)
  blockNumber: number;  // Block that included the tx
  gasUsed:     string;  // Gas used as a decimal string (bigint -> string)
}

export interface ChainServiceInterface {
  /**
   * Step A – Mint stablecoin into the sender's custodial wallet.
   * Called after fiat-in is confirmed.
   *
   * @param transferId   Unique transfer ID from the backend
   * @param senderUserId Supabase user UUID of the sender
   * @param amountMinor  Amount in AED minor units (1 AED = 100 units)
   */
  mintStable(
    transferId: string,
    senderUserId: string,
    amountMinor: number
  ): Promise<ChainReceipt>;

  /**
   * Step B – Lock the minted tokens in escrow for this transfer.
   * Called after mintStable succeeds.
   *
   * @param transferId      Unique transfer ID
   * @param senderUserId    Supabase user UUID of the sender
   * @param receiverUserId  Supabase user UUID of the receiver
   * @param amountMinor     Amount in AED minor units
   */
  lockForTransfer(
    transferId: string,
    senderUserId: string,
    receiverUserId: string,
    amountMinor: number
  ): Promise<ChainReceipt>;

  /**
   * Step C (success path) – Release escrowed tokens to the receiver.
   * Called after payout succeeds.
   *
   * @param transferId Unique transfer ID
   */
  releaseToReceiver(transferId: string): Promise<ChainReceipt>;

  /**
   * Step D (success path) – Burn tokens from receiver's wallet.
   * Called after release is confirmed (funds delivered off-chain).
   *
   * @param transferId     Unique transfer ID
   * @param receiverUserId Supabase user UUID of the receiver
   * @param amountMinor    Amount in AED minor units
   */
  burnStable(
    transferId: string,
    receiverUserId: string,
    amountMinor: number
  ): Promise<ChainReceipt>;

  /**
   * Step E (failure path) – Refund escrowed tokens back to sender.
   * Called when payout permanently fails.
   *
   * @param transferId Unique transfer ID
   */
  refund(transferId: string): Promise<ChainReceipt>;

  /**
   * Query the on-chain escrow state for a transfer.
   * 0=NONE, 1=LOCKED, 2=RELEASED, 3=REFUNDED
   */
  getEscrowState(transferId: string): Promise<number>;

  /**
   * Get the wallet address for a user (creates one if new).
   */
  getOrCreateWallet(userId: string): Promise<{ address: string }>;
}
