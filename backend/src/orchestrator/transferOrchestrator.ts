import crypto from "node:crypto";
import { db } from "../db/repository.js";
import { Transfer, TransferEvent, TransferStatus, RecipientDetails } from "../db/types.js";
import { quoteService } from "../services/quoteService.js";
import { kycService } from "../services/kycService.js";
import { amlService } from "../services/amlService.js";
import { mockChainService, ChainService } from "../services/chainService.js";
import { bankSimulator } from "../simulators/bankSimulator.js";
import { BadRequestError, NotFoundError, InvalidTransitionError } from "../utils/errors.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";

/**
 * SINGLE TRANSITION MAP:
 * Strictly defines every permitted state transition in the remittance lifecycle.
 * Any transition not explicitly listed here will be rejected with an error.
 */
export const ALLOWED_TRANSITIONS: Record<TransferStatus, readonly TransferStatus[]> = {
  CREATED: ["KYC_CHECK", "CANCELLED"],
  KYC_CHECK: ["AWAITING_FUNDS", "REJECTED", "CANCELLED"],
  AWAITING_FUNDS: ["FUNDS_RECEIVED", "CANCELLED", "FAILED"],
  FUNDS_RECEIVED: ["AML_CHECK", "REFUNDED", "FAILED"],
  AML_CHECK: ["CONVERTING", "AML_REVIEW", "REJECTED"],
  AML_REVIEW: ["CONVERTING", "REJECTED"],
  CONVERTING: ["PAYOUT_PENDING", "FAILED"],
  PAYOUT_PENDING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  REJECTED: [],
  FAILED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: []
};

export interface AdvanceEventInput {
  name: string;
  targetStatus: TransferStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateTransferInput {
  userId: string;
  quoteId: string;
  recipientDetails: RecipientDetails;
  senderAccountId?: string;
}

export class TransferOrchestrator {
  private chainService: ChainService;

  constructor(chainService: ChainService = mockChainService) {
    this.chainService = chainService;
  }

  /**
   * Initializes transfer from a locked, valid FX quote
   */
  public async createTransfer(input: CreateTransferInput): Promise<Transfer> {
    // Validate the non-INR demo payout details before consuming the quote.
    const candidate=await quoteService.getQuote(input.quoteId);
    if(candidate.user_id!==input.userId)throw new BadRequestError('Quote does not belong to authenticated user');
    if(candidate.target_currency!=='INR'&&!/^[a-zA-Z0-9 -]{4,34}$/.test(input.recipientDetails.account_number||''))throw new BadRequestError('A fictional bank account reference is required for this currency.');
    // 1. Validate & lock the quote (throws if expired or already consumed)
    const quote = await quoteService.validateAndConsumeQuote(input.quoteId, input.userId);

    const now = new Date().toISOString();
    const transfer: Transfer = {
      id: crypto.randomUUID(),
      user_id: input.userId,
      quote_id: quote.id,
      status: "CREATED",
      source_currency: quote.source_currency,
      target_currency: quote.target_currency,
      send_amount_minor: quote.send_amount_minor,
      receive_amount_minor: quote.receive_amount_minor,
      fee_minor: quote.fee_minor,
      exchange_rate: quote.exchange_rate,
      rate_provider: quote.rate_provider,
      rate_date: quote.rate_date,
      send_aed_minor: quote.send_aed_minor,
      sender_account_id: input.senderAccountId || null,
      recipient_details: input.recipientDetails,
      blockchain_tx_hash: null,
      payout_reference: null,
      cancellation_reason: null,
      failure_reason: null,
      created_at: now,
      updated_at: now
    };

    await db.transfers.insert(transfer);

    // Initial audit event
    await this.recordEvent(transfer.id, null, "CREATED", "TRANSFER_INITIALIZED", {
      quoteId: quote.id,
      sendAmountMinor: quote.send_amount_minor,
      receiveAmountMinor: quote.receive_amount_minor
    });

    // Auto-advance to KYC check
    return this.advance(transfer.id, {
      name: "INITIATE_KYC_VERIFICATION",
      targetStatus: "KYC_CHECK"
    });
  }

  /**
   * Core State Machine Transition Function
   * Validates allowed transition, updates DB state, records audit event,
   * and triggers the automated next step.
   */
  public async advance(
    transferId: string,
    event: AdvanceEventInput
  ): Promise<Transfer> {
    const transfer = await db.transfers.findById(transferId);
    if (!transfer) {
      throw new NotFoundError(`Transfer not found with ID: ${transferId}`);
    }

    const currentStatus = transfer.status;
    const targetStatus = event.targetStatus;

    // 1. Strict Transition Validation
    const allowedTargets = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
      throw new InvalidTransitionError(currentStatus, targetStatus, allowedTargets || []);
    }

    // 2. Persist updated transfer state
    const updated = await db.transfers.update(transferId, {
      status: targetStatus
    });

    if (!updated) {
      throw new NotFoundError(`Failed to update transfer state: ${transferId}`);
    }

    // 3. Write immutable audit log event
    await this.recordEvent(
      transferId,
      currentStatus,
      targetStatus,
      event.name,
      event.metadata || {}
    );

    // 4. Create user notification
    await db.notifications.insert({
      id: crypto.randomUUID(),
      user_id: updated.user_id,
      transfer_id: transferId,
      channel: "EMAIL",
      type: "TRANSFER_STATUS_UPDATE",
      payload: {
        from: currentStatus,
        to: targetStatus,
        event: event.name
      },
      status: "SENT",
      sent_at: new Date().toISOString(),
      error_message: null,
      created_at: new Date().toISOString()
    });

    logger.info(
      { transferId, from: currentStatus, to: targetStatus, event: event.name },
      "Transfer state machine advanced"
    );

    // 5. Trigger automated side-effects and subsequent pipeline steps
    return this.handlePostTransition(updated, targetStatus);
  }

  /**
   * Handles automated pipeline continuation for applicable states
   */
  private async handlePostTransition(
    transfer: Transfer,
    status: TransferStatus
  ): Promise<Transfer> {
    switch (status) {
      case "KYC_CHECK": {
        // Evaluate user's KYC record
        const kycStatus = await kycService.getKycStatus(transfer.user_id);
        if (kycStatus.status === "APPROVED") {
          return this.advance(transfer.id, {
            name: "KYC_VERIFIED_SUCCESS",
            targetStatus: "AWAITING_FUNDS"
          });
        } else if (kycStatus.status === "REJECTED") {
          return this.advance(transfer.id, {
            name: "KYC_VERIFIED_REJECTED",
            targetStatus: "REJECTED",
            metadata: { reason: "User KYC record rejected" }
          });
        }
        // If PENDING or NOT_STARTED, remains in KYC_CHECK until user submits KYC
        return transfer;
      }

      case "FUNDS_RECEIVED": {
        // Funds received from sender; trigger AML check
        return this.advance(transfer.id, {
          name: "TRIGGER_AML_SCREENING",
          targetStatus: "AML_CHECK"
        });
      }

      case "AML_CHECK": {
        // Run automated AML screen
        const amlResult = await amlService.screenTransfer(transfer);
        if (amlResult.action === "PASS") {
          return this.advance(transfer.id, {
            name: "AML_AUTOMATED_CLEARANCE",
            targetStatus: "CONVERTING"
          });
        } else if (amlResult.action === "FLAG_FOR_REVIEW") {
          await amlService.flagTransfer(
            transfer,
            amlResult.reason || "Manual review triggered",
            amlResult.severity || "MEDIUM"
          );
          return this.advance(transfer.id, {
            name: "AML_ESCALATED_TO_REVIEW",
            targetStatus: "AML_REVIEW",
            metadata: { reason: amlResult.reason }
          });
        } else {
          // REJECT
          await amlService.flagTransfer(
            transfer,
            amlResult.reason || "Sanctions match",
            "CRITICAL"
          );
          return this.advance(transfer.id, {
            name: "AML_FAILED_REJECTED",
            targetStatus: "REJECTED",
            metadata: { reason: amlResult.reason }
          });
        }
      }

      case "CONVERTING": {
        // Person 3 Blockchain integration step (mint/swap/burn)
        try {
          const swapResult = await withRetry(
            () =>
              this.chainService.convert(
                transfer.id,
                transfer.send_amount_minor,
                transfer.source_currency,
                transfer.target_currency
              ),
            { maxAttempts: 3, initialDelayMs: 20 },
            "ChainService.convert"
          );

          await db.transfers.update(transfer.id, {
            blockchain_tx_hash: swapResult.txHash
          });

          return this.advance(transfer.id, {
            name: "CHAIN_CONVERSION_SETTLED",
            targetStatus: "PAYOUT_PENDING",
            metadata: {
              txHash: swapResult.txHash,
              blockNumber: swapResult.blockNumber
            }
          });
        } catch (err) {
          logger.error({ err, transferId: transfer.id }, "Chain conversion error");
          await db.transfers.update(transfer.id, {
            failure_reason: "Blockchain conversion failed"
          });
          return this.advance(transfer.id, {
            name: "CHAIN_CONVERSION_FAILED",
            targetStatus: "FAILED"
          });
        }
      }

      case "PAYOUT_PENDING": {
        // Dispatches payout via local bank simulator (IMPS/UPI)
        const payoutResult = await bankSimulator.executePayout(
          transfer.id,
          transfer.receive_amount_minor,
          transfer.target_currency,
          transfer.recipient_details
        );

        if (payoutResult.status === "SUCCESS") {
          await db.transfers.update(transfer.id, {
            payout_reference: payoutResult.payoutReference
          });
          return this.advance(transfer.id, {
            name: "BANK_PAYOUT_SETTLED",
            targetStatus: "COMPLETED",
            metadata: { payoutReference: payoutResult.payoutReference }
          });
        } else {
          await db.transfers.update(transfer.id, {
            failure_reason: payoutResult.failureReason || "Beneficiary bank payout rejected"
          });
          return this.advance(transfer.id, {
            name: "BANK_PAYOUT_FAILED",
            targetStatus: "FAILED",
            metadata: { failureReason: payoutResult.failureReason }
          });
        }
      }

      default:
        return transfer;
    }
  }

  /**
   * Helper to write append-only transfer event
   */
  private async recordEvent(
    transferId: string,
    fromStatus: TransferStatus | null,
    toStatus: TransferStatus,
    eventName: string,
    metadata: Record<string, unknown>
  ): Promise<TransferEvent> {
    const event: TransferEvent = {
      id: crypto.randomUUID(),
      transfer_id: transferId,
      from_status: fromStatus,
      to_status: toStatus,
      event_name: eventName,
      metadata,
      created_at: new Date().toISOString()
    };
    await db.events.insert(event);
    return event;
  }

  /**
   * Fiat-In Webhook Entrypoint (called by banking simulator/webhook)
   */
  public async handleFiatInWebhook(
    transferId: string,
    payload: {
      mode: "success" | "insufficient" | "timeout";
      bankReference: string;
      depositedAmountMinor: number;
      expectedAmountMinor: number;
      webhookId: string;
    }
  ): Promise<Transfer> {
    const transfer = await db.transfers.findById(transferId);
    if (!transfer) {
      throw new NotFoundError(`Transfer not found: ${transferId}`);
    }

    if (payload.mode === "success") {
      return this.advance(transferId, {
        name: "FIAT_IN_DEPOSIT_CONFIRMED",
        targetStatus: "FUNDS_RECEIVED",
        metadata: {
          bankReference: payload.bankReference,
          depositedAmountMinor: payload.depositedAmountMinor,
          webhookId: payload.webhookId
        }
      });
    }

    if (payload.mode === "insufficient") {
      await db.transfers.update(transferId, {
        failure_reason: `Insufficient deposit: received ${payload.depositedAmountMinor} minor units, expected ${payload.expectedAmountMinor}`
      });
      return this.advance(transferId, {
        name: "FIAT_IN_INSUFFICIENT_FUNDS",
        targetStatus: "FAILED",
        metadata: {
          depositedAmountMinor: payload.depositedAmountMinor,
          expectedAmountMinor: payload.expectedAmountMinor,
          webhookId: payload.webhookId
        }
      });
    }

    // mode === "timeout"
    await db.transfers.update(transferId, {
      failure_reason: "Deposit window timed out without receiving funds"
    });
    return this.advance(transferId, {
      name: "FIAT_IN_DEPOSIT_TIMEOUT",
      targetStatus: "FAILED",
      metadata: { webhookId: payload.webhookId }
    });
  }

  /**
   * Payout Webhook Entrypoint (called by banking simulator/webhook)
   */
  public async handlePayoutWebhook(
    transferId: string,
    payload: {
      mode: "success" | "delayed" | "failed";
      payoutReference?: string;
      attemptNumber: number;
      maxAttempts: number;
      failureReason?: string;
      webhookId: string;
    }
  ): Promise<Transfer> {
    const transfer = await db.transfers.findById(transferId);
    if (!transfer) {
      throw new NotFoundError(`Transfer not found: ${transferId}`);
    }

    if (payload.mode === "success") {
      const ref = payload.payoutReference || `DEMO-${transfer.target_currency}-${Date.now()}`;
      await db.transfers.update(transferId, {
        payout_reference: ref
      });
      return this.advance(transferId, {
        name: "BANK_PAYOUT_SETTLED",
        targetStatus: "COMPLETED",
        metadata: {
          payoutReference: ref,
          webhookId: payload.webhookId
        }
      });
    }

    if (payload.mode === "delayed") {
      // Record audit event that payout is delayed in banking rail transit
      await this.recordEvent(
        transferId,
        transfer.status,
        transfer.status,
        "BANK_PAYOUT_PROCESSING_DELAYED",
        {
          attemptNumber: payload.attemptNumber,
          webhookId: payload.webhookId,
          message: "Beneficiary bank processing queue delayed"
        }
      );
      return transfer;
    }

    // mode === "failed"
    if (payload.attemptNumber < payload.maxAttempts) {
      // Retries remaining; record retry audit event
      await this.recordEvent(
        transferId,
        transfer.status,
        transfer.status,
        "BANK_PAYOUT_ATTEMPT_FAILED_RETRYING",
        {
          attemptNumber: payload.attemptNumber,
          maxAttempts: payload.maxAttempts,
          reason: payload.failureReason,
          webhookId: payload.webhookId
        }
      );
      return transfer;
    }

    // Retries exhausted -> Transition to FAILED, then auto-trigger REFUNDED
    await db.transfers.update(transferId, {
      failure_reason: payload.failureReason || "Beneficiary bank payout rejected after retries"
    });

    const failedTransfer = await this.advance(transferId, {
      name: "BANK_PAYOUT_RETRY_EXHAUSTED",
      targetStatus: "FAILED",
      metadata: {
        attempts: payload.attemptNumber,
        failureReason: payload.failureReason,
        webhookId: payload.webhookId
      }
    });

    // Auto-advance to REFUNDED as per state transition specification
    return this.advance(transferId, {
      name: "AUTOMATED_SENDER_REFUND_SETTLED",
      targetStatus: "REFUNDED",
      metadata: {
        refundedAmountMinor: failedTransfer.send_amount_minor,
        currency: failedTransfer.source_currency,
        reason: "Payout rail exhausted; funds refunded to sender account"
      }
    });
  }
}

export const transferOrchestrator = new TransferOrchestrator();
