"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockChainService = exports.MockChainService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const logger_js_1 = require("../utils/logger.js");
/**
 * Simulated in-memory blockchain service producing realistic transaction hashes and blocks
 */
class MockChainService {
    blockHeight = 18_450_200;
    async mintStablecoin(userId, amountMinor, currency) {
        const txHash = `0x${node_crypto_1.default.randomBytes(32).toString("hex")}`;
        this.blockHeight += 1;
        logger_js_1.logger.info({ userId, amountMinor, currency, txHash, blockNumber: this.blockHeight }, "Simulated on-chain stablecoin mint");
        return txHash;
    }
    async convert(transferId, amountMinor, fromCurrency, toCurrency) {
        // Simulate brief block confirmation latency
        await new Promise((resolve) => setTimeout(resolve, 30));
        this.blockHeight += 1;
        const txHash = `0x${node_crypto_1.default.randomBytes(32).toString("hex")}`;
        logger_js_1.logger.info({
            transferId,
            amountMinor,
            fromCurrency,
            toCurrency,
            txHash,
            blockNumber: this.blockHeight
        }, "Simulated on-chain cross-border stablecoin swap / liquidity pool conversion");
        return {
            txHash,
            sourceAmountMinor: amountMinor,
            fromCurrency,
            toCurrency,
            blockNumber: this.blockHeight,
            timestamp: new Date().toISOString()
        };
    }
    async burnStablecoin(userId, amountMinor, currency) {
        const txHash = `0x${node_crypto_1.default.randomBytes(32).toString("hex")}`;
        this.blockHeight += 1;
        logger_js_1.logger.info({ userId, amountMinor, currency, txHash, blockNumber: this.blockHeight }, "Simulated on-chain stablecoin burn upon fiat settlement");
        return txHash;
    }
}
exports.MockChainService = MockChainService;
exports.mockChainService = new MockChainService();
