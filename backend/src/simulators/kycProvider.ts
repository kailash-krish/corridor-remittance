import crypto from "node:crypto";
import { KycStatus } from "../db/types.js";

export interface KycVerificationRequest {
  userId: string;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  idType: string;
  idNumber: string;
  country: string;
}

export interface KycVerificationResponse {
  providerReference: string;
  status: KycStatus;
  rejectionReason: string | null;
  reviewedAt: string;
}

/**
 * Interface contract for external KYC verification vendors (e.g. Onfido, Sumsub, Jumio)
 */
export interface KycProvider {
  verify(request: KycVerificationRequest): Promise<KycVerificationResponse>;
}

/**
 * Deterministic Mock KYC Provider for student project & automated integration testing
 */
export class MockKycProvider implements KycProvider {
  private simulatedLatencyMs: number;

  constructor(simulatedLatencyMs = 25) {
    this.simulatedLatencyMs = simulatedLatencyMs;
  }

  public async verify(request: KycVerificationRequest): Promise<KycVerificationResponse> {
    // Simulate network roundtrip to external KYC vendor
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }

    const providerRef = `MOCK-KYC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const cleanId = request.idNumber.trim();

    // Deterministic Mock Rules:
    // 1. Ending with "0000" -> REJECTED (e.g. Politically Exposed Person / Sanctions match)
    if (cleanId.endsWith("0000")) {
      return {
        providerReference: providerRef,
        status: "REJECTED",
        rejectionReason: "ID flagged on sanctions / fraud watch-list",
        reviewedAt: new Date().toISOString()
      };
    }

    // 2. Ending with "9999" -> REVIEW (e.g. Document blur / manual inspection needed)
    if (cleanId.endsWith("9999")) {
      return {
        providerReference: providerRef,
        status: "REVIEW",
        rejectionReason: "Document image quality low; escalated to manual compliance review",
        reviewedAt: new Date().toISOString()
      };
    }

    // 3. Otherwise -> APPROVED
    return {
      providerReference: providerRef,
      status: "APPROVED",
      rejectionReason: null,
      reviewedAt: new Date().toISOString()
    };
  }
}

export const mockKycProvider = new MockKycProvider();
