"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutSimulator = exports.PayoutSimulator = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const transferOrchestrator_js_1 = require("../orchestrator/transferOrchestrator.js");
const errors_js_1 = require("../utils/errors.js");
const repository_js_1 = require("../db/repository.js");
const logger_js_1 = require("../utils/logger.js");
// In-memory retry tracker per transfer payout
const payoutAttempts = new Map();
class PayoutSimulator {
    /**
     * Simulates an external Indian banking rail payout webhook (NPCI / RazorpayX / Cashfree)
     * Dispatches outcomes (success, delayed, failed with retries) into the orchestrator.
     */
    async simulatePayoutWebhook(transferId, mode = "success", overrides) {
        const transfer = await repository_js_1.db.transfers.findById(transferId);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Transfer not found with ID: ${transferId}`);
        }
        if (transfer.status !== "PAYOUT_PENDING") {
            throw new errors_js_1.BadRequestError(`Cannot simulate payout for transfer in state '${transfer.status}'. Transfer must be in 'PAYOUT_PENDING'.`);
        }
        const currentAttempt = (payoutAttempts.get(transferId) || 0) + 1;
        payoutAttempts.set(transferId, currentAttempt);
        const maxAttempts = 2; // Retry once before marking terminal failure and initiating refund
        const payoutRef = mode === "success"
            ? `${transfer.target_currency === "INR" ? "IMPS" : "DEMO-" + transfer.target_currency}-SETTLED-${node_crypto_1.default.randomBytes(4).toString("hex").toUpperCase()}`
            : `FAIL-RETRY-${node_crypto_1.default.randomBytes(3).toString("hex").toUpperCase()}`;
        const failureReason = mode === "failed"
            ? overrides?.failureReason ||
                "Beneficiary bank response: account restricted / invalid IFSC code"
            : undefined;
        const webhookPayload = {
            webhookId: `WH-OUT-${node_crypto_1.default.randomBytes(4).toString("hex").toUpperCase()}`,
            transferId,
            payoutReference: overrides?.payoutReference || payoutRef,
            rail: transfer.target_currency !== "INR" ? "DEMO_BANK" : transfer.recipient_details.upi_id ? "UPI" : "IMPS",
            recipientDetails: transfer.recipient_details,
            amountMinor: transfer.receive_amount_minor,
            currency: transfer.target_currency,
            mode,
            attemptNumber: currentAttempt,
            maxAttempts,
            failureReason,
            timestamp: new Date().toISOString(),
            ...overrides
        };
        logger_js_1.logger.info({ transferId, mode, currentAttempt, maxAttempts, webhookPayload }, "Outbound payout banking simulator dispatched webhook into orchestrator");
        // Call orchestrator webhook handler (no direct DB edits)
        return transferOrchestrator_js_1.transferOrchestrator.handlePayoutWebhook(transferId, webhookPayload);
    }
    resetAttempts(transferId) {
        payoutAttempts.delete(transferId);
    }
}
exports.PayoutSimulator = PayoutSimulator;
exports.payoutSimulator = new PayoutSimulator();
