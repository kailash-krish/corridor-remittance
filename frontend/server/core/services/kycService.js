"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycService = exports.KycService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const repository_js_1 = require("../db/repository.js");
const kycProvider_js_1 = require("../simulators/kycProvider.js");
class KycService {
    provider;
    constructor(provider = kycProvider_js_1.mockKycProvider) {
        this.provider = provider;
    }
    /**
     * Submits user KYC payload to provider and persists resulting state
     */
    async submitKyc(userId, input) {
        const now = new Date().toISOString();
        // Call external KYC provider (simulated)
        const verification = await this.provider.verify({
            userId,
            ...input
        });
        const record = {
            id: node_crypto_1.default.randomUUID(),
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
        await repository_js_1.db.kyc.upsert(record);
        // Record notification outbox entry
        await repository_js_1.db.notifications.insert({
            id: node_crypto_1.default.randomUUID(),
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
    async getKycRecord(userId) {
        return repository_js_1.db.kyc.findByUserId(userId);
    }
    /**
     * Returns current user KYC status or NOT_STARTED if no profile submitted yet
     */
    async getKycStatus(userId) {
        const record = await this.getKycRecord(userId);
        return {
            status: record ? record.status : "NOT_STARTED",
            record
        };
    }
    /**
     * Quick check for transfer orchestrator
     */
    async isKycApproved(userId) {
        const record = await this.getKycRecord(userId);
        return record?.status === "APPROVED";
    }
}
exports.KycService = KycService;
exports.kycService = new KycService();
