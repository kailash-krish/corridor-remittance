"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteService = exports.QuoteService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const repository_js_1 = require("../db/repository.js");
const fxService_js_1 = require("./fxService.js");
const errors_js_1 = require("../utils/errors.js");
// Quotes are guaranteed and locked for 60 seconds
const DEFAULT_QUOTE_TTL_SECONDS = 60;
class QuoteService {
    /**
     * Generates, locks, and persists an FX quote for 60 seconds
     */
    async createQuote(input) {
        const calc = await fxService_js_1.fxService.calculateQuote(input.sourceCurrency, input.targetCurrency, input.sendAmountMinor);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DEFAULT_QUOTE_TTL_SECONDS * 1000);
        const quote = {
            id: node_crypto_1.default.randomUUID(),
            user_id: input.userId,
            source_currency: calc.sourceCurrency,
            target_currency: calc.targetCurrency,
            send_amount_minor: calc.sendAmountMinor,
            receive_amount_minor: calc.receiveAmountMinor,
            fee_minor: calc.feeMinor,
            exchange_rate: calc.exchangeRate,
            rate_provider: calc.rateProvider,
            rate_date: calc.rateDate,
            send_aed_minor: calc.sendAedMinor,
            expires_at: expiresAt.toISOString(),
            is_consumed: false,
            consumed_at: null,
            created_at: now.toISOString()
        };
        await repository_js_1.db.quotes.insert(quote);
        return this.enrichQuote(quote);
    }
    /**
     * Fetches quote by ID and calculates its dynamic expiry status
     */
    async getQuote(id) {
        const quote = await repository_js_1.db.quotes.findById(id);
        if (!quote) {
            throw new errors_js_1.NotFoundError(`Quote not found with ID: ${id}`);
        }
        return this.enrichQuote(quote);
    }
    /**
     * Retrieves quotes for a user
     */
    async getUserQuotes(userId) {
        const quotes = await repository_js_1.db.quotes.findByUserId(userId);
        return quotes.map((q) => this.enrichQuote(q));
    }
    /**
     * Validates and locks/consumes an unexpired quote for a transfer
     */
    async validateAndConsumeQuote(id, userId) {
        const quote = await repository_js_1.db.quotes.findById(id);
        if (!quote) {
            throw new errors_js_1.NotFoundError(`Quote not found: ${id}`);
        }
        if (quote.user_id !== userId) {
            throw new errors_js_1.BadRequestError("Quote does not belong to authenticated user");
        }
        if (quote.is_consumed) {
            throw new errors_js_1.BadRequestError("Quote has already been consumed by an existing transfer");
        }
        const isExpired = new Date(quote.expires_at).getTime() < Date.now();
        if (isExpired) {
            throw new errors_js_1.BadRequestError("Quote has expired. Please generate a new quote.");
        }
        await repository_js_1.db.quotes.markConsumed(id);
        return {
            ...quote,
            is_consumed: true,
            consumed_at: new Date().toISOString()
        };
    }
    enrichQuote(quote) {
        const now = Date.now();
        const expiresAtMs = new Date(quote.expires_at).getTime();
        const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
        let status = "ACTIVE";
        if (quote.is_consumed) {
            status = "CONSUMED";
        }
        else if (remainingSeconds <= 0) {
            status = "EXPIRED";
        }
        return {
            ...quote,
            expiresInSeconds: remainingSeconds,
            status
        };
    }
}
exports.QuoteService = QuoteService;
exports.quoteService = new QuoteService();
