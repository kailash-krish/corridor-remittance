import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Health Check Endpoint", () => {
  it("GET /health should return 200 with status ok and request id", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("version", "1.0.0");
    expect(res.headers).toHaveProperty("x-request-id");
  });

  it("should preserve custom x-request-id if provided", async () => {
    const customId = "client-req-12345";
    const res = await request(app)
      .get("/health")
      .set("x-request-id", customId);

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe(customId);
  });
});
