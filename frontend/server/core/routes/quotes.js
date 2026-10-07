"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const quoteService_js_1 = require("../services/quoteService.js");
const auth_js_1 = require("../middleware/auth.js");
const errors_js_1 = require("../utils/errors.js");
exports.quotesRouter = (0, express_1.Router)();
const createQuoteSchema = zod_1.z.object({
    sourceCurrency: zod_1.z.string().min(3).max(3),
    targetCurrency: zod_1.z.string().min(3).max(3),
    // Integer minor units (e.g. 10000 = 100.00 AED)
    sendAmountMinor: zod_1.z.number().int().positive()
});
// POST /quotes: Create locked FX quote
exports.quotesRouter.post("/", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const parsed = createQuoteSchema.safeParse(req.body);
        if (!parsed.success) {
            throw parsed.error;
        }
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const quote = await quoteService_js_1.quoteService.createQuote({
            userId: req.user.id,
            sourceCurrency: parsed.data.sourceCurrency,
            targetCurrency: parsed.data.targetCurrency,
            sendAmountMinor: parsed.data.sendAmountMinor
        });
        res.status(201).json({
            data: quote
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /quotes: List user's quotes
exports.quotesRouter.get("/", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const quotes = await quoteService_js_1.quoteService.getUserQuotes(req.user.id);
        res.status(200).json({
            data: quotes
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /quotes/:id: Retrieve quote details and expiry status
exports.quotesRouter.get("/:id", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const quote = await quoteService_js_1.quoteService.getQuote(req.params.id);
        res.status(200).json({
            data: quote
        });
    }
    catch (err) {
        next(err);
    }
});
