import crypto from "node:crypto";
import { Transfer } from "../db/types.js";
import { transferOrchestrator } from "../orchestrator/transferOrchestrator.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { db } from "../db/repository.js";
import { logger } from "../utils/logger.js";

export type FiatInMode = "success" | "insufficient" | "timeout";

export interface FiatInWebhookPayload {
  webhookId: string;
  transferId: string;
  bankReference: string;
  senderIban?: string;
  depositedAmountMinor: number;
  expectedAmountMinor: number;
  currency: string;
  mode: FiatInMode;
  timestamp: string;
}

export class FiatInSimulator {
  /**
   * Simulates an external inbound banking webhook (e.g. UAE Central Bank / ENBD IPP rail)
   * Rather than editing the DB directly, this constructs a realistic bank webhook
   * and invokes the orchestrator webhook handler.
   */
  public async simulateFiatIn(
    transferId: string,
    mode: FiatInMode = "success",
    overrides?: Partial<FiatInWebhookPayload>
  ): Promise<Transfer> {
    const transfer = await db.transfers.findById(transferId);
    if (!transfer) {
      throw new NotFoundError(`Transfer not found with ID: ${transferId}`);
    }

    if (transfer.status !== "AWAITING_FUNDS") {
      throw new BadRequestError(
        `Cannot process fiat-in for transfer in state '${transfer.status}'. Transfer must be in 'AWAITING_FUNDS'.`
      );
    }

    const expectedAmount = transfer.send_amount_minor;
    let depositedAmount = expectedAmount;

    if (mode === "insufficient") {
      // Deposited 50% of the required amount
      depositedAmount = Math.floor(expectedAmount / 2);
    }

    const webhookPayload: FiatInWebhookPayload = {
      webhookId: `WH-IN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      transferId,
      bankReference: overrides?.bankReference || `UAE-BANK-REF-${Date.now()}`,
      senderIban: transfer.sender_account_id || "AE290331234567890123456",
      depositedAmountMinor: overrides?.depositedAmountMinor ?? depositedAmount,
      expectedAmountMinor: expectedAmount,
      currency: transfer.source_currency,
      mode,
      timestamp: new Date().toISOString(),
      ...overrides
    };

    logger.info(
      { transferId, mode, webhookPayload },
      "Inbound fiat banking simulator dispatched webhook into orchestrator"
    );

    // Call orchestrator webhook handler (no direct DB edits)
    return transferOrchestrator.handleFiatInWebhook(transferId, webhookPayload);
  }
}

export const fiatInSimulator = new FiatInSimulator();
