"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankSimulator = exports.BankSimulator = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const logger_js_1 = require("../utils/logger.js");
class BankSimulator {
    /**
     * Simulates Indian banking rails (IMPS / NEFT / UPI rail) clearing payout in INR
     */
    async executePayout(transferId, amountMinor, targetCurrency, recipient) {
        // Simulate payment network rail processing latency
        await new Promise((resolve) => setTimeout(resolve, 30));
        // Deterministic simulation: if recipient account number ends in "0000", payout fails
        if (recipient.account_number?.endsWith("0000")) {
            logger_js_1.logger.warn({ transferId, recipient }, "Simulated recipient bank rejected payout");
            return {
                payoutReference: `FAIL-${node_crypto_1.default.randomBytes(4).toString("hex").toUpperCase()}`,
                clearedAt: new Date().toISOString(),
                status: "FAILED",
                failureReason: "Beneficiary bank account invalid or frozen"
            };
        }
        const payoutRef = `${targetCurrency === "INR" ? "IMPS" : "DEMO-" + targetCurrency}-${Date.now()}-${node_crypto_1.default.randomBytes(3).toString("hex").toUpperCase()}`;
        logger_js_1.logger.info({
            transferId,
            amountMinor,
            targetCurrency,
            recipientName: recipient.name,
            payoutRef
        }, "Simulated local banking rail payout executed successfully");
        return {
            payoutReference: payoutRef,
            clearedAt: new Date().toISOString(),
            status: "SUCCESS"
        };
    }
}
exports.BankSimulator = BankSimulator;
exports.bankSimulator = new BankSimulator();
