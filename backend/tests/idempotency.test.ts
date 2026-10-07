import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { inMemoryDb, db } from "../src/db/repository.js";

describe("Idempotency Middleware", () => {
  const userId = "idem-user-1";
  const userToken = jwt.sign(
    { sub: userId, email: "idem@example.com", role: "authenticated" },
    env.SUPABASE_JWT_SECRET
  );

  beforeEach(() => {
    inMemoryDb.reset();
  });

  const getQuote = async () => {
    await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fullName: "Idem Tester",
        dateOfBirth: "1990-01-01",
        idType: "NATIONAL_ID",
        idNumber: "784-1990-1111222-1",
        country: "ARE"
      });

    const quoteRes = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sourceCurrency: "AED", targetCurrency: "INR", sendAmountMinor: 50000 });
    return quoteRes.body.data.id;
  };

  it("should replay cached response when same Idempotency-Key is sent with identical payload", async () => {
    const quoteId = await getQuote();
    const idempotencyKey = "key-idem-test-12345";

    const payload = {
      quoteId,
      recipientDetails: { name: "Anand Gupta", country: "IND" }
    };

    // First request -> creates transfer
    const firstRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(firstRes.status).toBe(201);
    const firstTransferId = firstRes.body.data.id;
    expect(firstRes.headers["idempotent-replay"]).toBeUndefined();

    // Repeated request with exact same key & payload -> replays cached response
    const secondRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.id).toBe(firstTransferId);
    expect(secondRes.headers["idempotent-replay"]).toBe("true");

    // Ensure database still contains only 1 transfer
    const allTransfers = await db.transfers.findByUserId(userId);
    expect(allTransfers.length).toBe(1);
  });

  it("should reject request with 409 Conflict when same Idempotency-Key is reused with different payload", async () => {
    const quoteId = await getQuote();
    const idempotencyKey = "key-conflict-test-67890";

    // First request
    await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        quoteId,
        recipientDetails: { name: "Person One", country: "IND" }
      });

    // Second request with SAME key but DIFFERENT payload
    const conflictRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        quoteId,
        recipientDetails: { name: "Person Two Different Payload", country: "IND" }
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(conflictRes.body.error.message).toContain("different request payload");
  });
});
