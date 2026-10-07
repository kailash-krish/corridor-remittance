import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { inMemoryDb } from "../src/db/repository.js";

describe("KYC Mock Verifier & Endpoints", () => {
  const createToken = (userId: string) => {
    return jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role: "authenticated" },
      env.SUPABASE_JWT_SECRET
    );
  };

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it("GET /kyc/status should return NOT_STARTED when user has no record", async () => {
    const token = createToken("user-fresh");
    const res = await request(app)
      .get("/kyc/status")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("NOT_STARTED");
    expect(res.body.data.record).toBeNull();
  });

  it("POST /kyc/submit should return APPROVED for regular valid ID", async () => {
    const token = createToken("user-approved");
    const res = await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Fatima Al Mansoori",
        dateOfBirth: "1994-08-15",
        idType: "NATIONAL_ID",
        idNumber: "784-1994-1234567-1",
        country: "ARE"
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");
    expect(res.body.data.provider_reference).toMatch(/^MOCK-KYC-/);
    expect(res.body.data.rejection_reason).toBeNull();

    // Verify GET /kyc/status reflects APPROVED
    const statusRes = await request(app)
      .get("/kyc/status")
      .set("Authorization", `Bearer ${token}`);
    expect(statusRes.body.data.status).toBe("APPROVED");
  });

  it("POST /kyc/submit should return REJECTED for ID ending in '0000'", async () => {
    const token = createToken("user-rejected");
    const res = await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Bad Actor",
        dateOfBirth: "1980-01-01",
        idType: "PASSPORT",
        idNumber: "P99880000",
        country: "ARE"
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REJECTED");
    expect(res.body.data.rejection_reason).toContain("sanctions");
  });

  it("POST /kyc/submit should return REVIEW for ID ending in '9999'", async () => {
    const token = createToken("user-review");
    const res = await request(app)
      .post("/kyc/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Edge Case User",
        dateOfBirth: "1990-05-20",
        idType: "RESIDENCE_VISA",
        idNumber: "RV11229999",
        country: "ARE"
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REVIEW");
    expect(res.body.data.rejection_reason).toContain("manual compliance review");
  });
});
