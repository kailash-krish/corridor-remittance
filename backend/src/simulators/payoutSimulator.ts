import crypto from "node:crypto";
import { Transfer } from "../db/types.js";
import { transferOrchestrator } from "../orchestrator/transferOrchestrator.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { db } from "../db/repository.js";
import { logger } from "../utils/logger.js";

export type PayoutMode = "success" | "delayed" | "failed";

export interface PayoutWebhookPayload {
  webhookId: string;
  transferId: string;
  payoutReference: string;
  rail: "IMPS" | "UPI" | "NEFT";
  recipientDetails: Record<string, unknown>;
  amountMinor: number;
  currency: string;
  mode: PayoutMode;
  attemptNumber: number;
  maxAttempts: number;
  failureReason?: string;
  timestamp: string;
}

// In-memory retry tracker per transfer payout
const payoutAttempts = new Map<string, number>();

export class PayoutSimulator {
  /**
   * Simulates an external Indian banking rail payout webhook (NPCI / RazorpayX / Cashfree)
   * Dispatches outcomes (success, delayed, failed with retries) into the orchestrator.
   */
  public async simulatePayoutWebhook(
    transferId: string,
    mode: PayoutMode = "success",
    overrides?: Partial<PayoutWebhookPayload>
  ): Promise<Transfer> {
    const transfer = await db.transfers.findById(transferId);
    if (!transfer) {
      throw new NotFoundError(`Transfer not found with ID: ${transferId}`);
    }

    if (transfer.status !== "PAYOUT_PENDING") {
      throw new BadRequestError(
        `Cannot simulate payout for transfer in state '${transfer.status}'. Transfer must be in 'PAYOUT_PENDING'.`
      );
    }

    const currentAttempt = (payoutAttempts.get(transferId) || 0) + 1;
    payoutAttempts.set(transferId, currentAttempt);

    const maxAttempts = 2; // Retry once before marking terminal failure and initiating refund

    const payoutRef =
      mode === "success"
        ? `IMPS-SETTLED-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
        : `FAIL-RETRY-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const failureReason =
      mode === "failed"
        ? overrides?.failureReason ||
          "Beneficiary bank response: account restricted / invalid IFSC code"
        : undefined;

    const webhookPayload: PayoutWebhookPayload = {
      webhookId: `WH-OUT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      transferId,
      payoutReference: overrides?.payoutReference || payoutRef,
      rail: transfer.recipient_details.upi_id ? "UPI" : "IMPS",
      recipientDetails: transfer.recipient_details as unknown as Record<string, unknown>,
      amountMinor: transfer.receive_amount_minor,
      currency: transfer.target_currency,
      mode,
      attemptNumber: currentAttempt,
      maxAttempts,
      failureReason,
      timestamp: new Date().toISOString(),
      ...overrides
    };

    logger.info(
      { transferId, mode, currentAttempt, maxAttempts, webhookPayload },
      "Outbound payout banking simulator dispatched webhook into orchestrator"
    );

    // Call orchestrator webhook handler (no direct DB edits)
    return transferOrchestrator.handlePayoutWebhook(transferId, webhookPayload);
  }

  public resetAttempts(transferId: string): void {
    payoutAttempts.delete(transferId);
  }
}

export const payoutSimulator = new PayoutSimulator();
