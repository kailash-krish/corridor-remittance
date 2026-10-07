import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Auth Middleware", () => {
  const validUserPayload = {
    sub: "user-uuid-1234",
    email: "sender@example.com",
    role: "authenticated",
    app_metadata: { role: "user" },
    user_metadata: { name: "Ahmed UAE" }
  };

  const validAdminPayload = {
    sub: "admin-uuid-5678",
    email: "compliance@example.com",
    role: "authenticated",
    app_metadata: { role: "admin" },
    user_metadata: { name: "Compliance Officer" }
  };

  const createToken = (payload: object, secret = env.SUPABASE_JWT_SECRET, expiresIn = "1h") => {
    return jwt.sign(payload, secret, { expiresIn });
  };

  describe("requireAuth", () => {
    it("should reject requests without Authorization header with 401", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or malformed Authorization header",
          details: null
        }
      });
      expect(res.headers).toHaveProperty("x-request-id");
    });

    it("should reject requests with invalid token with 401", async () => {
      const invalidToken = createToken(validUserPayload, "wrong-secret-key");
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${invalidToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
      expect(res.body.error.message).toMatch(/invalid signature/i);
    });

    it("should reject requests with malformed Authorization header with 401", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Token invalid-format");

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should accept valid token and attach user to req", async () => {
      const token = createToken(validUserPayload);
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: validUserPayload.sub,
        email: validUserPayload.email,
        role: "user",
        metadata: {
          role: "user",
          name: "Ahmed UAE"
        }
      });
    });
  });

  describe("requireAdmin", () => {
    it("should return 403 Forbidden when authenticated non-admin attempts admin route", async () => {
      const userToken = createToken(validUserPayload);
      const res = await request(app)
        .get("/api/admin/ping")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: {
          code: "FORBIDDEN",
          message: "Admin privileges required to perform this action",
          details: null
        }
      });
    });

    it("should return 200 OK when authenticated admin accesses admin route", async () => {
      const adminToken = createToken(validAdminPayload);
      const res = await request(app)
        .get("/api/admin/ping")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Admin access granted");
    });
  });

  describe("Standard Error Handling Format", () => {
    it("should return standard error format on 404", async () => {
      const res = await request(app).get("/api/non-existent-endpoint");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Route not found: GET /api/non-existent-endpoint",
          details: null
        }
      });
      expect(res.headers).toHaveProperty("x-request-id");
    });
  });
});
