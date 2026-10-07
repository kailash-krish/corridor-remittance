"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fiatInSimulator = exports.FiatInSimulator = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const transferOrchestrator_js_1 = require("../orchestrator/transferOrchestrator.js");
const errors_js_1 = require("../utils/errors.js");
const repository_js_1 = require("../db/repository.js");
const logger_js_1 = require("../utils/logger.js");
class FiatInSimulator {
    /**
     * Simulates an external inbound banking webhook (e.g. UAE Central Bank / ENBD IPP rail)
     * Rather than editing the DB directly, this constructs a realistic bank webhook
     * and invokes the orchestrator webhook handler.
     */
    async simulateFiatIn(transferId, mode = "success", overrides) {
        const transfer = await repository_js_1.db.transfers.findById(transferId);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Transfer not found with ID: ${transferId}`);
        }
        if (transfer.status !== "AWAITING_FUNDS") {
            throw new errors_js_1.BadRequestError(`Cannot process fiat-in for transfer in state '${transfer.status}'. Transfer must be in 'AWAITING_FUNDS'.`);
        }
        const expectedAmount = transfer.send_amount_minor;
        let depositedAmount = expectedAmount;
        if (mode === "insufficient") {
            // Deposited 50% of the required amount
            depositedAmount = Math.floor(expectedAmount / 2);
        }
        const webhookPayload = {
            webhookId: `WH-IN-${node_crypto_1.default.randomBytes(4).toString("hex").toUpperCase()}`,
            transferId,
            bankReference: overrides?.bankReference || `DEMO-${transfer.source_currency}-BANK-${Date.now()}`,
            senderIban: transfer.sender_account_id || "AE290331234567890123456",
            depositedAmountMinor: overrides?.depositedAmountMinor ?? depositedAmount,
            expectedAmountMinor: expectedAmount,
            currency: transfer.source_currency,
            mode,
            timestamp: new Date().toISOString(),
            ...overrides
        };
        logger_js_1.logger.info({ transferId, mode, webhookPayload }, "Inbound fiat banking simulator dispatched webhook into orchestrator");
        // Call orchestrator webhook handler (no direct DB edits)
        return transferOrchestrator_js_1.transferOrchestrator.handleFiatInWebhook(transferId, webhookPayload);
    }
}
exports.FiatInSimulator = FiatInSimulator;
exports.fiatInSimulator = new FiatInSimulator();
