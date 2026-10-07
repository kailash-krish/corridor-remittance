"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const kycService_js_1 = require("../services/kycService.js");
const auth_js_1 = require("../middleware/auth.js");
const errors_js_1 = require("../utils/errors.js");
exports.kycRouter = (0, express_1.Router)();
const submitKycSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(100),
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
    idType: zod_1.z.enum(["PASSPORT", "NATIONAL_ID", "RESIDENCE_VISA", "DRIVING_LICENSE"]),
    idNumber: zod_1.z.string().min(4).max(50),
    country: zod_1.z.string().min(2).max(3)
});
// POST /kyc/submit: Submit identity verification payload
exports.kycRouter.post("/submit", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        const parsed = submitKycSchema.safeParse(req.body);
        if (!parsed.success) {
            throw parsed.error;
        }
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const result = await kycService_js_1.kycService.submitKyc(req.user.id, {
            fullName: parsed.data.fullName,
            dateOfBirth: parsed.data.dateOfBirth,
            idType: parsed.data.idType,
            idNumber: parsed.data.idNumber,
            country: parsed.data.country
        });
        res.status(200).json({
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /kyc/status: Retrieve current KYC verification status
exports.kycRouter.get("/status", auth_js_1.requireAuth, async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const statusResponse = await kycService_js_1.kycService.getKycStatus(req.user.id);
        res.status(200).json({
            data: statusResponse
        });
    }
    catch (err) {
        next(err);
    }
});
