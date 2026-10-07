import crypto from "node:crypto";
import { db } from "../db/repository.js";
import { KycRecord, KycStatus } from "../db/types.js";
import { KycProvider, mockKycProvider } from "../simulators/kycProvider.js";

export interface SubmitKycInput {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  idType: string;
  idNumber: string;
  country: string;
}

export class KycService {
  private provider: KycProvider;

  constructor(provider: KycProvider = mockKycProvider) {
    this.provider = provider;
  }

  /**
   * Submits user KYC payload to provider and persists resulting state
   */
  public async submitKyc(userId: string, input: SubmitKycInput): Promise<KycRecord> {
    const now = new Date().toISOString();

    // Call external KYC provider (simulated)
    const verification = await this.provider.verify({
      userId,
      ...input
    });

    const record: KycRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      full_name: input.fullName,
      date_of_birth: input.dateOfBirth,
      id_type: input.idType,
      id_number: input.idNumber,
      country: input.country.toUpperCase(),
      status: verification.status,
      provider_reference: verification.providerReference,
      rejection_reason: verification.rejectionReason,
      submitted_at: now,
      reviewed_at: verification.reviewedAt,
      created_at: now,
      updated_at: now
    };

    await db.kyc.upsert(record);

    // Record notification outbox entry
    await db.notifications.insert({
      id: crypto.randomUUID(),
      user_id: userId,
      transfer_id: null,
      channel: "EMAIL",
      type: "KYC_STATUS_UPDATE",
      payload: {
        status: record.status,
        providerReference: record.provider_reference,
        rejectionReason: record.rejection_reason
      },
      status: "SENT",
      sent_at: new Date().toISOString(),
      error_message: null,
      created_at: now
    });

    return record;
  }

  /**
   * Retrieves current KYC record and status for user
   */
  public async getKycRecord(userId: string): Promise<KycRecord | null> {
    return db.kyc.findByUserId(userId);
  }

  /**
   * Returns current user KYC status or NOT_STARTED if no profile submitted yet
   */
  public async getKycStatus(userId: string): Promise<{ status: KycStatus; record: KycRecord | null }> {
    const record = await this.getKycRecord(userId);
    return {
      status: record ? record.status : "NOT_STARTED",
      record
    };
  }

  /**
   * Quick check for transfer orchestrator
   */
  public async isKycApproved(userId: string): Promise<boolean> {
    const record = await this.getKycRecord(userId);
    return record?.status === "APPROVED";
  }
}

export const kycService = new KycService();
