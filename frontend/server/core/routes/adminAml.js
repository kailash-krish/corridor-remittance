"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAmlRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const amlService_js_1 = require("../services/amlService.js");
const auth_js_1 = require("../middleware/auth.js");
const errors_js_1 = require("../utils/errors.js");
exports.adminAmlRouter = (0, express_1.Router)();
// Apply auth + admin role protection across all /admin/aml routes
exports.adminAmlRouter.use(auth_js_1.requireAuth, auth_js_1.requireAdmin);
const decisionSchema = zod_1.z.object({
    decision: zod_1.z.enum(["approve", "reject"]),
    note: zod_1.z.string().min(3, "Compliance decision must include an explanatory note")
});
// GET /admin/aml/queue: List pending compliance reviews
exports.adminAmlRouter.get("/queue", async (_req, res, next) => {
    try {
        const queue = await amlService_js_1.amlService.getPendingQueue();
        res.status(200).json({
            data: queue
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /admin/aml/:id: Get specific AML flag with detailed transfer info
exports.adminAmlRouter.get("/:id", async (req, res, next) => {
    try {
        const details = await amlService_js_1.amlService.getFlagDetails(req.params.id);
        res.status(200).json({
            data: details
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /admin/aml/:id/decision: Admin approves or rejects flagged transfer
exports.adminAmlRouter.post("/:id/decision", async (req, res, next) => {
    try {
        const parsed = decisionSchema.safeParse(req.body);
        if (!parsed.success) {
            throw parsed.error;
        }
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Admin user required");
        }
        const result = await amlService_js_1.amlService.processAdminDecision(req.params.id, req.user.id, parsed.data.decision, parsed.data.note);
        res.status(200).json({
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
