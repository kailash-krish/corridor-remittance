import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { inMemoryDb, db } from "../src/db/repository.js";

describe("Admin AML Endpoints", () => {
  const userId = "flagged-user-1";
  const adminId = "compliance-lead-1";

  const userToken = jwt.sign(
    { sub: userId, email: "flagged@example.com", role: "authenticated" },
    env.SUPABASE_JWT_SECRET
  );

  const adminToken = jwt.sign(
    {
      sub: adminId,
      email: "lead@compliance.com",
      role: "authenticated",
      app_metadata: { role: "admin" }
    },
    env.SUPABASE_JWT_SECRET
  );

  beforeEach(() => {
    inMemoryDb.reset();
  });

  const setupFlaggedTransfer = async () => {
    // 1. Submit KYC
    await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fullName: "Tariq Ali",
        dateOfBirth: "1988-11-03",
        idType: "NATIONAL_ID",
        idNumber: "784-1988-5544332-1",
        country: "ARE"
      });

    // 2. Create quote with amount over threshold (52,000 AED = 5,200,000 fils)
    const quoteRes = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sourceCurrency: "AED",
        targetCurrency: "INR",
        sendAmountMinor: 5_200_000
      });

    // 3. Create transfer
    const transferRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId: quoteRes.body.data.id,
        recipientDetails: { name: "Ananya Iyer", country: "IND" }
      });

    const transferId = transferRes.body.data.id;

    // 4. Deposit funds -> Triggers AML check -> flags transfer & pauses at AML_REVIEW
    await request(app)
      .post(`/sim/fiat-in/${transferId}?mode=success`)
      .set("Authorization", `Bearer ${userToken}`)
      .send();

    const amlFlag = await db.aml.findByTransferId(transferId);
    return { transferId, amlFlag };
  };

  it("GET /admin/aml/queue should list pending reviews for admin and reject non-admin", async () => {
    const { transferId, amlFlag } = await setupFlaggedTransfer();
    expect(amlFlag).toBeDefined();

    // Regular user cannot view queue
    const nonAdminRes = await request(app)
      .get("/admin/aml/queue")
      .set("Authorization", `Bearer ${userToken}`);
    expect(nonAdminRes.status).toBe(403);

    // Admin views queue
    const adminRes = await request(app)
      .get("/admin/aml/queue")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(adminRes.body.data[0].flag.id).toBe(amlFlag?.id);
    expect(adminRes.body.data[0].transfer.id).toBe(transferId);
  });

  it("POST /admin/aml/:id/decision should approve transfer and advance through orchestrator to COMPLETED", async () => {
    const { transferId, amlFlag } = await setupFlaggedTransfer();

    const decisionRes = await request(app)
      .post(`/admin/aml/${amlFlag?.id}/decision`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "approve",
        note: "Audited bank statements, source of funds confirmed legit"
      });

    expect(decisionRes.status).toBe(200);
    expect(decisionRes.body.data.flag.status).toBe("APPROVED");
    expect(decisionRes.body.data.flag.decision_notes).toContain("Audited bank statements");

    // The transfer was resumed by orchestrator, completed chain swap, and settled
    expect(decisionRes.body.data.transfer.status).toBe("COMPLETED");

    // Verify events recorded decision
    const events = await db.events.findByTransferId(transferId);
    const approvalEvent = events.find((e) => e.event_name === "AML_ADMIN_MANUAL_APPROVED");
    expect(approvalEvent).toBeDefined();
    expect(approvalEvent?.metadata).toHaveProperty("reviewedBy", adminId);
  });

  it("POST /admin/aml/:id/decision should reject transfer when compliance officer rejects", async () => {
    const { amlFlag } = await setupFlaggedTransfer();

    const decisionRes = await request(app)
      .post(`/admin/aml/${amlFlag?.id}/decision`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "reject",
        note: "Failed source of funds verification; suspicious transactions"
      });

    expect(decisionRes.status).toBe(200);
    expect(decisionRes.body.data.flag.status).toBe("REJECTED");
    expect(decisionRes.body.data.transfer.status).toBe("REJECTED");
  });
});
