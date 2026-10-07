import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { inMemoryDb, db } from "../src/db/repository.js";
import { payoutSimulator } from "../src/simulators/payoutSimulator.js";

describe("Banking Simulators (Fiat-In and Payout)", () => {
  const userId = "sim-user-1";
  const userToken = jwt.sign(
    { sub: userId, email: "sim@example.com", role: "authenticated" },
    env.SUPABASE_JWT_SECRET
  );

  beforeEach(() => {
    inMemoryDb.reset();
  });

  const setupTransferInAwaitingFunds = async () => {
    // 1. Submit KYC
    await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fullName: "Zayed Al Nahyan",
        dateOfBirth: "1991-07-21",
        idType: "NATIONAL_ID",
        idNumber: "784-1991-1122334-1",
        country: "ARE"
      });

    // 2. Create quote
    const quoteRes = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sourceCurrency: "AED",
        targetCurrency: "INR",
        sendAmountMinor: 100000
      });
    const quoteId = quoteRes.body.data.id;

    // 3. Create transfer -> Auto moves to AWAITING_FUNDS
    const transferRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId,
        recipientDetails: {
          name: "Deepak Patel",
          account_number: "123456789012",
          country: "IND"
        }
      });

    return transferRes.body.data.id;
  };

  describe("Fiat-in Simulator (POST /sim/fiat-in/:transferId)", () => {
    it("should successfully confirm funds received via webhook simulation", async () => {
      const transferId = await setupTransferInAwaitingFunds();

      const res = await request(app)
        .post(`/sim/fiat-in/${transferId}?mode=success`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ bankReference: "ENBD-WH-998877" });

      expect(res.status).toBe(200);
      expect(res.body.simulator).toBe("fiat-in");
      expect(res.body.mode).toBe("success");
      // State machine progressed past FUNDS_RECEIVED to COMPLETED
      expect(res.body.data.status).toBe("COMPLETED");

      // Verify webhook audit event
      const events = await db.events.findByTransferId(transferId);
      const fiatInEvent = events.find((e) => e.event_name === "FIAT_IN_DEPOSIT_CONFIRMED");
      expect(fiatInEvent).toBeDefined();
      expect(fiatInEvent?.metadata).toHaveProperty("bankReference", "ENBD-WH-998877");
    });

    it("should handle failure mode 'insufficient' by moving transfer to FAILED", async () => {
      const transferId = await setupTransferInAwaitingFunds();

      const res = await request(app)
        .post(`/sim/fiat-in/${transferId}?mode=insufficient`)
        .set("Authorization", `Bearer ${userToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe("insufficient");
      expect(res.body.data.status).toBe("FAILED");
      expect(res.body.data.failure_reason).toContain("Insufficient deposit");
    });

    it("should handle failure mode 'timeout' by moving transfer to FAILED", async () => {
      const transferId = await setupTransferInAwaitingFunds();

      const res = await request(app)
        .post(`/sim/fiat-in/${transferId}?mode=timeout`)
        .set("Authorization", `Bearer ${userToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe("timeout");
      expect(res.body.data.status).toBe("FAILED");
      expect(res.body.data.failure_reason).toContain("timed out");
    });
  });

  describe("Payout Simulator (POST /sim/payout/:transferId)", () => {
    it("should handle delayed payout outcome and record transit event", async () => {
      const transferId = await setupTransferInAwaitingFunds();

      // Manually set transfer to PAYOUT_PENDING to test payout simulator isolation
      await db.transfers.update(transferId, { status: "PAYOUT_PENDING" });
      payoutSimulator.resetAttempts(transferId);

      const delayedRes = await request(app)
        .post(`/sim/payout/${transferId}?mode=delayed`)
        .set("Authorization", `Bearer ${userToken}`)
        .send();

      expect(delayedRes.status).toBe(200);
      expect(delayedRes.body.mode).toBe("delayed");
      expect(delayedRes.body.data.status).toBe("PAYOUT_PENDING");

      const events = await db.events.findByTransferId(transferId);
      const delayEvent = events.find((e) => e.event_name === "BANK_PAYOUT_PROCESSING_DELAYED");
      expect(delayEvent).toBeDefined();
    });

    it("should handle failure with retry, then trigger automated refund to REFUNDED", async () => {
      const transferId = await setupTransferInAwaitingFunds();

      await db.transfers.update(transferId, { status: "PAYOUT_PENDING" });
      payoutSimulator.resetAttempts(transferId);

      // Attempt 1: Fails, but retries remain -> stays in PAYOUT_PENDING
      const firstFailRes = await request(app)
        .post(`/sim/payout/${transferId}?mode=failed`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ failureReason: "Network timeout connecting to clearing house" });

      expect(firstFailRes.status).toBe(200);
      expect(firstFailRes.body.data.status).toBe("PAYOUT_PENDING");

      // Attempt 2: Max attempts (2) reached -> Fails and auto-triggers REFUNDED
      const secondFailRes = await request(app)
        .post(`/sim/payout/${transferId}?mode=failed`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ failureReason: "Bank network rejected transfer; retry threshold exceeded" });

      expect(secondFailRes.status).toBe(200);
      expect(secondFailRes.body.data.status).toBe("REFUNDED");
      expect(secondFailRes.body.data.failure_reason).toContain("rejected");

      const events = await db.events.findByTransferId(transferId);
      const eventNames = events.map((e) => e.event_name);
      expect(eventNames).toContain("BANK_PAYOUT_ATTEMPT_FAILED_RETRYING");
      expect(eventNames).toContain("BANK_PAYOUT_RETRY_EXHAUSTED");
      expect(eventNames).toContain("AUTOMATED_SENDER_REFUND_SETTLED");
    });
  });
});
