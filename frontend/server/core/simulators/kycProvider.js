"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockKycProvider = exports.MockKycProvider = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * Deterministic Mock KYC Provider for student project & automated integration testing
 */
class MockKycProvider {
    simulatedLatencyMs;
    constructor(simulatedLatencyMs = 25) {
        this.simulatedLatencyMs = simulatedLatencyMs;
    }
    async verify(request) {
        // Simulate network roundtrip to external KYC vendor
        if (this.simulatedLatencyMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
        }
        const providerRef = `MOCK-KYC-${node_crypto_1.default.randomBytes(4).toString("hex").toUpperCase()}`;
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
exports.MockKycProvider = MockKycProvider;
exports.mockKycProvider = new MockKycProvider();
