"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transfersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const repository_js_1 = require("../db/repository.js");
const transferOrchestrator_js_1 = require("../orchestrator/transferOrchestrator.js");
const auth_js_1 = require("../middleware/auth.js");
const idempotency_js_1 = require("../middleware/idempotency.js");
const errors_js_1 = require("../utils/errors.js");
exports.transfersRouter = (0, express_1.Router)();
const createTransferSchema = zod_1.z.object({
    quoteId: zod_1.z.string().uuid(),
    senderAccountId: zod_1.z.string().optional(),
    recipientDetails: zod_1.z.object({
        name: zod_1.z.string().min(2),
        account_number: zod_1.z.string().optional(),
        ifsc: zod_1.z.string().optional(),
        upi_id: zod_1.z.string().optional(),
        bank_name: zod_1.z.string().optional(),
        country: zod_1.z.string().default("IND")
    })
});
const amlReviewSchema = zod_1.z.object({
    decision: zod_1.z.enum(["APPROVE", "REJECT"]),
    notes: zod_1.z.string().optional()
});
// POST /transfers: Create transfer referencing quote (idempotent)
exports.transfersRouter.post("/", auth_js_1.requireAuth, idempotency_js_1.requireIdempotency, async (req, res, next) => {
    try {
        const parsed = createTransferSchema.safeParse(req.body);
        if (!parsed.success) {
            throw parsed.error;
        }
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const transfer = await transferOrchestrator_js_1.transferOrchestrator.createTransfer({
            userId: req.user.id,
            quoteId: parsed.data.quoteId,
            senderAccountId: parsed.data.senderAccountId,
            recipientDetails: parsed.data.recipientDetails
        });
        res.status(201).json({
            data: transfer
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /transfers: List user's transfers
exports.transfersRouter.get("/", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const userTransfers = await repository_js_1.db.transfers.findByUserId(req.user.id);
        res.status(200).json({
            data: userTransfers
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /transfers/:id: Transfer details with event history
exports.transfersRouter.get("/:id", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const transfer = await repository_js_1.db.transfers.findById(req.params.id);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        // Check ownership (or admin role)
        if (req.user?.role !== "admin" && transfer.user_id !== req.user?.id) {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        const events = await repository_js_1.db.events.findByTransferId(transfer.id);
        res.status(200).json({
            data: {
                ...transfer,
                events
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /transfers/:id/events: Dedicated audit events history
exports.transfersRouter.get("/:id/events", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const transfer = await repository_js_1.db.transfers.findById(req.params.id);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        if (req.user?.role !== "admin" && transfer.user_id !== req.user?.id) {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        const events = await repository_js_1.db.events.findByTransferId(transfer.id);
        res.status(200).json({
            data: events
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /transfers/:id/cancel: User cancels transfer if allowed
exports.transfersRouter.post("/:id/cancel", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const transfer = await repository_js_1.db.transfers.findById(req.params.id);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        if (transfer.user_id !== req.user?.id && req.user?.role !== "admin") {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        const updated = await transferOrchestrator_js_1.transferOrchestrator.advance(transfer.id, {
            name: "USER_REQUESTED_CANCELLATION",
            targetStatus: "CANCELLED",
            metadata: {
                cancelledBy: req.user.id,
                reason: req.body.reason || "User requested cancellation"
            }
        });
        res.status(200).json({
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /transfers/:id/deposit: Simulates UAE bank funds deposit
exports.transfersRouter.post("/:id/deposit", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const transfer = await repository_js_1.db.transfers.findById(req.params.id);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        if (transfer.user_id !== req.user?.id && req.user?.role !== "admin") {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        const updated = await transferOrchestrator_js_1.transferOrchestrator.advance(transfer.id, {
            name: "SENDER_DEPOSIT_CONFIRMED",
            targetStatus: "FUNDS_RECEIVED",
            metadata: {
                depositedAmountMinor: transfer.send_amount_minor,
                sourceCurrency: transfer.source_currency,
                bankReference: req.body.bankReference || `DEMO-${transfer.source_currency}-BANK-${Date.now()}`
            }
        });
        res.status(200).json({
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /transfers/:id/aml-review: Admin decision for AML_REVIEW status
exports.transfersRouter.post("/:id/aml-review", auth_js_1.requireAuth, auth_js_1.requireAdmin, async (req, res, next) => {
    try {
        const parsed = amlReviewSchema.safeParse(req.body);
        if (!parsed.success) {
            throw parsed.error;
        }
        const transfer = await repository_js_1.db.transfers.findById(req.params.id);
        if (!transfer) {
            throw new errors_js_1.NotFoundError(`Transfer not found: ${req.params.id}`);
        }
        if (transfer.status !== "AML_REVIEW") {
            throw new errors_js_1.BadRequestError(`Cannot review transfer in status: ${transfer.status}. Must be in AML_REVIEW.`);
        }
        // Update AML Flag
        const flag = await repository_js_1.db.aml.findByTransferId(transfer.id);
        if (flag) {
            await repository_js_1.db.aml.update(flag.id, {
                status: parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
                decision_notes: parsed.data.notes || null,
                reviewed_by: req.user?.id,
                reviewed_at: new Date().toISOString()
            });
        }
        // Advance transfer
        const targetStatus = parsed.data.decision === "APPROVE" ? "CONVERTING" : "REJECTED";
        const eventName = parsed.data.decision === "APPROVE"
            ? "AML_MANUAL_REVIEW_APPROVED"
            : "AML_MANUAL_REVIEW_REJECTED";
        const updated = await transferOrchestrator_js_1.transferOrchestrator.advance(transfer.id, {
            name: eventName,
            targetStatus,
            metadata: {
                reviewerId: req.user?.id,
                notes: parsed.data.notes
            }
        });
        res.status(200).json({
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
