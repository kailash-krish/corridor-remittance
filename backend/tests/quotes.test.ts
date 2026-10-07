import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { inMemoryDb } from "../src/db/repository.js";

describe("Quotes Service & Endpoints", () => {
  const userId = "user-test-quotes-1";
  const token = jwt.sign(
    { sub: userId, email: "quoteuser@example.com", role: "authenticated" },
    env.SUPABASE_JWT_SECRET
  );

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it("POST /quotes should create a locked quote with fee calculation and 60s expiry", async () => {
    const res = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceCurrency: "AED",
        targetCurrency: "INR",
        sendAmountMinor: 100000 // 1,000.00 AED
      });

    expect(res.status).toBe(201);
    const quote = res.body.data;
    expect(quote).toHaveProperty("id");
    expect(quote.user_id).toBe(userId);
    expect(quote.source_currency).toBe("AED");
    expect(quote.target_currency).toBe("INR");
    expect(quote.send_amount_minor).toBe(100000);
    expect(quote.fee_minor).toBeGreaterThan(0); // 500 flat + 500 (0.5%) = 1000 fils
    expect(quote.receive_amount_minor).toBeGreaterThan(0);
    expect(quote.exchange_rate).toBeGreaterThan(20);
    expect(quote.status).toBe("ACTIVE");
    expect(quote.expiresInSeconds).toBeGreaterThanOrEqual(58);
  });

  it("POST /quotes should reject invalid or non-positive amounts", async () => {
    const res = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceCurrency: "AED",
        targetCurrency: "INR",
        sendAmountMinor: -50
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /quotes/:id should return quote with dynamic expiry status", async () => {
    const createRes = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sourceCurrency: "AED",
        targetCurrency: "INR",
        sendAmountMinor: 50000
      });

    const quoteId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(quoteId);
    expect(getRes.body.data.status).toBe("ACTIVE");
  });

  it("GET /quotes should list all quotes for the authenticated user", async () => {
    await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceCurrency: "AED", targetCurrency: "INR", sendAmountMinor: 20000 });

    await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceCurrency: "USD", targetCurrency: "INR", sendAmountMinor: 10000 });

    const listRes = await request(app)
      .get("/quotes")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(2);
  });
});
