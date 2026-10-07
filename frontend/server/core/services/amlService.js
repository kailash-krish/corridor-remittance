"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.amlService = exports.AmlService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const repository_js_1 = require("../db/repository.js");
const amlRules_js_1 = require("./amlRules.js");
const transferOrchestrator_js_1 = require("../orchestrator/transferOrchestrator.js");
const errors_js_1 = require("../utils/errors.js");
const logger_js_1 = require("../utils/logger.js");
class AmlService {
    /**
     * Evaluates transfer against the pure AML rules engine
     */
    async screenTransfer(transfer) {
        // 1. Gather historical context for user
        const userTransfers = await repository_js_1.db.transfers.findByUserId(transfer.user_id);
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentTransfers24h = userTransfers.filter((t) => new Date(t.created_at).getTime() >= oneDayAgo);
        // 2. Evaluate pure rules
        const assessment = (0, amlRules_js_1.evaluateAmlRules)({
            transfer,
            recentTransfers24h,
            userTotalTransfersCount: userTransfers.length
        });
        logger_js_1.logger.info({
            transferId: transfer.id,
            riskScore: assessment.riskScore,
            riskLevel: assessment.riskLevel,
            triggeredRules: assessment.triggeredRules.map((r) => r.rule)
        }, "AML compliance assessment completed");
        if (assessment.recommendedAction === "PASS") {
            return {
                action: "PASS",
                assessment
            };
        }
        // Compose explanatory reason from triggered rules
        const combinedReason = assessment.triggeredRules.map((r) => r.reason).join(" | ");
        if (assessment.recommendedAction === "REVIEW") {
            await this.flagTransfer(transfer, combinedReason, "MEDIUM", assessment);
            return {
                action: "FLAG_FOR_REVIEW",
                reason: combinedReason,
                severity: "MEDIUM",
                assessment
            };
        }
        // HOLD / Critical Flag (score >= 70)
        await this.flagTransfer(transfer, combinedReason, "CRITICAL", assessment);
        return {
            action: "FLAG_FOR_REVIEW", // Sent to admin AML_REVIEW queue
            reason: combinedReason,
            severity: "CRITICAL",
            assessment
        };
    }
    /**
     * Persists an AML flag record in the database
     */
    async flagTransfer(transfer, reason, severity, assessment) {
        const flag = {
            id: node_crypto_1.default.randomUUID(),
            transfer_id: transfer.id,
            user_id: transfer.user_id,
            reason,
            severity,
            status: "PENDING",
            decision_notes: assessment ? `Score: ${assessment.riskScore}/100 (${assessment.riskLevel})` : null,
            reviewed_by: null,
            reviewed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await repository_js_1.db.aml.insert(flag);
        return flag;
    }
    /**
     * Admin: List pending AML review queue
     */
    async getPendingQueue() {
        const pendingFlags = await repository_js_1.db.aml.findAllPending();
        const items = [];
        for (const flag of pendingFlags) {
            const transfer = await repository_js_1.db.transfers.findById(flag.transfer_id);
            items.push({ flag, transfer });
        }
        return items;
    }
    /**
     * Admin: Retrieve specific AML flag details with transfer
     */
    async getFlagDetails(flagId) {
        const flag = await repository_js_1.db.aml.findById(flagId);
        if (!flag) {
            throw new errors_js_1.NotFoundError(`AML Flag not found: ${flagId}`);
        }
        const transfer = await repository_js_1.db.transfers.findById(flag.transfer_id);
        return { flag, transfer };
    }
    /**
     * Admin: Decision endpoint (approve | reject).
     * MUST go through the transfer orchestrator to trigger next steps!
     */
    async processAdminDecision(flagId, adminUserId, decision, note) {
        const flag = await repository_js_1.db.aml.findById(flagId);
        if (!flag) {
            throw new errors_js_1.NotFoundError(`AML Flag not found: ${flagId}`);
        }
        if (flag.status !== "PENDING") {
            throw new errors_js_1.BadRequestError(`AML Flag has already been resolved: ${flag.status}`);
        }
        const transfer = await repository_js_1.db.transfers.findById(flag.transfer_id);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Associated transfer not found: ${flag.transfer_id}`);
        }
        // 1. Update flag
        const updatedFlag = await repository_js_1.db.aml.update(flagId, {
            status: decision === "approve" ? "APPROVED" : "REJECTED",
            decision_notes: note,
            reviewed_by: adminUserId,
            reviewed_at: new Date().toISOString()
        });
        // 2. Advance the transfer via orchestrator
        const targetStatus = decision === "approve" ? "CONVERTING" : "REJECTED";
        const eventName = decision === "approve"
            ? "AML_ADMIN_MANUAL_APPROVED"
            : "AML_ADMIN_MANUAL_REJECTED";
        const updatedTransfer = await transferOrchestrator_js_1.transferOrchestrator.advance(transfer.id, {
            name: eventName,
            targetStatus,
            metadata: {
                flagId,
                decision,
                reviewedBy: adminUserId,
                note
            }
        });
        return {
            flag: updatedFlag || flag,
            transfer: updatedTransfer
        };
    }
}
exports.AmlService = AmlService;
exports.amlService = new AmlService();
