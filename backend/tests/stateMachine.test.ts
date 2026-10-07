import { describe, it, expect, beforeEach } from "vitest";
import { transferOrchestrator, ALLOWED_TRANSITIONS } from "../src/orchestrator/transferOrchestrator.js";
import { db, inMemoryDb } from "../src/db/repository.js";
import { Transfer, TransferStatus } from "../src/db/types.js";
import { InvalidTransitionError } from "../src/utils/errors.js";

describe("State Machine Transition Map Validation", () => {
  beforeEach(() => {
    inMemoryDb.reset();
  });

  const createDummyTransfer = async (status: TransferStatus): Promise<Transfer> => {
    const transfer: Transfer = {
      id: `tx-${Math.random()}`,
      user_id: "user-test",
      quote_id: "quote-test",
      status,
      source_currency: "AED",
      target_currency: "INR",
      send_amount_minor: 100000,
      receive_amount_minor: 2270000,
      fee_minor: 1000,
      exchange_rate: 22.7,
      sender_account_id: null,
      recipient_details: { name: "Test User", country: "IND" },
      blockchain_tx_hash: null,
      payout_reference: null,
      cancellation_reason: null,
      failure_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await db.transfers.insert(transfer);
    return transfer;
  };

  it("should have correct permitted transitions defined for all states", () => {
    expect(ALLOWED_TRANSITIONS.CREATED).toEqual(["KYC_CHECK", "CANCELLED"]);
    expect(ALLOWED_TRANSITIONS.KYC_CHECK).toEqual(["AWAITING_FUNDS", "REJECTED", "CANCELLED"]);
    expect(ALLOWED_TRANSITIONS.AWAITING_FUNDS).toEqual(["FUNDS_RECEIVED", "CANCELLED", "FAILED"]);
    expect(ALLOWED_TRANSITIONS.FUNDS_RECEIVED).toEqual(["AML_CHECK", "REFUNDED", "FAILED"]);
    expect(ALLOWED_TRANSITIONS.AML_CHECK).toEqual(["CONVERTING", "AML_REVIEW", "REJECTED"]);
    expect(ALLOWED_TRANSITIONS.AML_REVIEW).toEqual(["CONVERTING", "REJECTED"]);
    expect(ALLOWED_TRANSITIONS.CONVERTING).toEqual(["PAYOUT_PENDING", "FAILED"]);
    expect(ALLOWED_TRANSITIONS.PAYOUT_PENDING).toEqual(["COMPLETED", "FAILED"]);
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.FAILED).toEqual(["REFUNDED"]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it("should throw InvalidTransitionError when attempting unpermitted transition", async () => {
    // Cannot jump from CREATED directly to COMPLETED
    const transfer = await createDummyTransfer("CREATED");

    await expect(
      transferOrchestrator.advance(transfer.id, {
        name: "ILLEGAL_JUMP",
        targetStatus: "COMPLETED"
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("should throw InvalidTransitionError when attempting transition from terminal COMPLETED state", async () => {
    const transfer = await createDummyTransfer("COMPLETED");

    await expect(
      transferOrchestrator.advance(transfer.id, {
        name: "ILLEGAL_CANCEL",
        targetStatus: "CANCELLED"
      })
    ).rejects.toThrow(InvalidTransitionError);
  });
});
