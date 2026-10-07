import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { inMemoryDb } from "../src/db/repository.js";
import { notificationService } from "../src/services/notificationService.js";

describe("Notifications & Audit Log Endpoints", () => {
  const userId = "notif-user-1";
  const userToken = jwt.sign(
    { sub: userId, email: "notif@example.com", role: "authenticated" },
    env.SUPABASE_JWT_SECRET
  );

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it("NotificationService should emit events on new notification dispatch", async () => {
    let emitted = false;
    const testListener = () => {
      emitted = true;
    };

    notificationService.once("notification:created", testListener);

    await notificationService.createNotification({
      userId,
      type: "FUNDS_RECEIVED",
      payload: { amountMinor: 100000, currency: "AED" }
    });

    expect(emitted).toBe(true);
  });

  it("GET /notifications and POST /notifications/:id/read", async () => {
    const notif = await notificationService.createNotification({
      userId,
      type: "TRANSFER_COMPLETED",
      payload: { payoutReference: "IMPS-123456" }
    });

    // 1. List notifications
    const listRes = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${userToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(notif.id);

    // 2. Mark as read
    const readRes = await request(app)
      .post(`/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.data.is_read).toBe(true);
  });

  it("GET /transfers/:id/events should return chronological audit log", async () => {
    // 1. Submit KYC
    await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fullName: "Sultan Al Qasimi",
        dateOfBirth: "1993-02-14",
        idType: "NATIONAL_ID",
        idNumber: "784-1993-4455667-1",
        country: "ARE"
      });

    // 2. Create quote
    const quoteRes = await request(app)
      .post("/quotes")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sourceCurrency: "AED", targetCurrency: "INR", sendAmountMinor: 100000 });

    // 3. Create transfer
    const transferRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        quoteId: quoteRes.body.data.id,
        recipientDetails: { name: "Sunita Rao", country: "IND" }
      });
    const transferId = transferRes.body.data.id;

    // 4. Deposit funds -> settles to COMPLETED
    await request(app)
      .post(`/sim/fiat-in/${transferId}?mode=success`)
      .set("Authorization", `Bearer ${userToken}`)
      .send();

    // 5. Query dedicated audit events endpoint
    const eventsRes = await request(app)
      .get(`/transfers/${transferId}/events`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(eventsRes.status).toBe(200);
    expect(Array.isArray(eventsRes.body.data)).toBe(true);
    expect(eventsRes.body.data.length).toBeGreaterThanOrEqual(6);

    // Ensure events are chronological
    const timestamps = eventsRes.body.data.map((e: { created_at: string }) =>
      new Date(e.created_at).getTime()
    );
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });
});
