import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { inMemoryDb } from "../src/db/repository.js";

describe("Transfer Orchestrator State Machine", () => {
  const userId = "sender-uae-1";
  const adminId = "compliance-officer-1";

  const userToken = jwt.sign(
    { sub: userId, email: "sender@example.com", role: "authenticated" },
    env.SUPABASE_JWT_SECRET
  );

  const adminToken = jwt.sign(
    {
      sub: adminId,
      email: "admin@example.com",
      role: "authenticated",
      app_metadata: { role: "admin" }
    },
    env.SUPABASE_JWT_SECRET
  );

  beforeEach(() => {
    inMemoryDb.reset();
  });

  const setupApprovedKyc = async () => {
    await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fullName: "Rashid Saeed",
        dateOfBirth: "1992-04-10",
        idType: "NATIONAL_ID",
        idNumber: "784-1992-9876543-1",
        country: "ARE"
      });
  };

  const getQuote = async (amountMinor = 100000) => {
    const res = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sourceCurrency: "AED",
        targetCurrency: "INR",
        sendAmountMinor: amountMinor
      });
    return res.body.data;
  };

  it("End-to-End Happy Flow: CREATED -> KYC_CHECK -> AWAITING_FUNDS -> FUNDS_RECEIVED -> AML_CHECK -> CONVERTING -> PAYOUT_PENDING -> COMPLETED", async () => {
    // 1. Approve user KYC
    await setupApprovedKyc();

    // 2. Lock quote for 1,000 AED (100,000 fils)
    const quote = await getQuote(100000);

    // 3. Initiate Transfer
    const createRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId: quote.id,
        recipientDetails: {
          name: "Amit Sharma",
          account_number: "987654321012",
          ifsc: "HDFC0001234",
          country: "IND"
        }
      });

    expect(createRes.status).toBe(201);
    const transfer = createRes.body.data;
    // Because KYC is already APPROVED, the orchestrator auto-advanced to AWAITING_FUNDS
    expect(transfer.status).toBe("AWAITING_FUNDS");

    // 4. Verify Quote is consumed and cannot be reused
    const duplicateRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId: quote.id,
        recipientDetails: { name: "Amit Sharma", country: "IND" }
      });
    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.error.message).toContain("already been consumed");

    // 5. Simulate sender depositing UAE bank funds
    const depositRes = await request(app)
      .post(`/transfers/${transfer.id}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ bankReference: "MOCK-ENBD-DEPOSIT-12345" });

    expect(depositRes.status).toBe(200);
    const settledTransfer = depositRes.body.data;

    // State machine automatically progresses through AML -> Chain Conversion -> Payout -> COMPLETED
    expect(settledTransfer.status).toBe("COMPLETED");
    expect(settledTransfer.blockchain_tx_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(settledTransfer.payout_reference).toMatch(/^IMPS-/);

    // 6. Verify audit event log timeline
    const getRes = await request(app)
      .get(`/transfers/${transfer.id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(getRes.status).toBe(200);
    const events = getRes.body.data.events;
    expect(events.length).toBeGreaterThanOrEqual(6);

    const statuses = events.map((e: { to_status: string }) => e.to_status);
    expect(statuses).toContain("CREATED");
    expect(statuses).toContain("KYC_CHECK");
    expect(statuses).toContain("AWAITING_FUNDS");
    expect(statuses).toContain("FUNDS_RECEIVED");
    expect(statuses).toContain("AML_CHECK");
    expect(statuses).toContain("CONVERTING");
    expect(statuses).toContain("PAYOUT_PENDING");
    expect(statuses).toContain("COMPLETED");
  });

  it("Strict State Machine: Throws error on illegal transition", async () => {
    await setupApprovedKyc();
    const quote = await getQuote(10000);

    const createRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId: quote.id,
        recipientDetails: { name: "Sita Verma", country: "IND" }
      });

    const transferId = createRes.body.data.id;

    // Deposit and complete transfer
    await request(app)
      .post(`/transfers/${transferId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send();

    // Now in COMPLETED status, attempting to CANCEL must fail
    const cancelRes = await request(app)
      .post(`/transfers/${transferId}/cancel`)
      .set("Authorization", `Bearer ${userToken}`)
      .send();

    expect(cancelRes.status).toBe(400);
    expect(cancelRes.body.error.message).toContain("Illegal state transition from COMPLETED to CANCELLED");
  });

  it("Cancellation: User cancels transfer while AWAITING_FUNDS", async () => {
    await setupApprovedKyc();
    const quote = await getQuote(25000);

    const createRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId: quote.id,
        recipientDetails: { name: "Vijay Kumar", country: "IND" }
      });

    const transferId = createRes.body.data.id;

    const cancelRes = await request(app)
      .post(`/transfers/${transferId}/cancel`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ reason: "Changed my mind" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("CANCELLED");
  });

  it("Compliance Flow: High-value transfer triggers AML_REVIEW and requires Admin approval", async () => {
    await setupApprovedKyc();
    // 55,000 AED = 5,500,000 fils (exceeds threshold of 5,000,000 fils)
    const quote = await getQuote(5500000);

    const createRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId: quote.id,
        recipientDetails: { name: "High Net Worth Receiver", country: "IND" }
      });

    const transferId = createRes.body.data.id;

    // Deposit funds
    const depositRes = await request(app)
      .post(`/transfers/${transferId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send();

    // Must be paused at AML_REVIEW
    expect(depositRes.body.data.status).toBe("AML_REVIEW");

    // Regular user cannot approve AML review
    const nonAdminReview = await request(app)
      .post(`/transfers/${transferId}/aml-review`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ decision: "APPROVE" });
    expect(nonAdminReview.status).toBe(403);

    // Admin approves AML review
    const adminReview = await request(app)
      .post(`/transfers/${transferId}/aml-review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "APPROVE",
        notes: "Source of funds bank statement verified"
      });

    expect(adminReview.status).toBe(200);
    // Pipeline resumes and settles to COMPLETED
    expect(adminReview.body.data.status).toBe("COMPLETED");
  });
});
