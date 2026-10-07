"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulatorsRouter = void 0;
const express_1 = require("express");
const fiatInSimulator_js_1 = require("../simulators/fiatInSimulator.js");
const payoutSimulator_js_1 = require("../simulators/payoutSimulator.js");
const auth_js_1 = require("../middleware/auth.js");
const idempotency_js_1 = require("../middleware/idempotency.js");
exports.simulatorsRouter = (0, express_1.Router)();
// POST /sim/fiat-in/:transferId: Inbound UAE fiat deposit webhook simulator
// Supports query: ?mode=success | insufficient | timeout
exports.simulatorsRouter.post("/fiat-in/:transferId", auth_js_1.requireAuth, idempotency_js_1.requireIdempotency, async (req, res, next) => {
    try {
        const mode = req.query.mode || "success";
        const transferId = req.params.transferId;
        const result = await fiatInSimulator_js_1.fiatInSimulator.simulateFiatIn(transferId, mode, req.body);
        res.status(200).json({
            status: "ok",
            simulator: "fiat-in",
            mode,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /sim/payout/:transferId: Outbound INR IMPS/UPI banking payout webhook simulator
// Supports query: ?mode=success | delayed | failed
exports.simulatorsRouter.post("/payout/:transferId", auth_js_1.requireAuth, idempotency_js_1.requireIdempotency, async (req, res, next) => {
    try {
        const mode = req.query.mode || "success";
        const transferId = req.params.transferId;
        const result = await payoutSimulator_js_1.payoutSimulator.simulatePayoutWebhook(transferId, mode, req.body);
        res.status(200).json({
            status: "ok",
            simulator: "payout",
            mode,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
