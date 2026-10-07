import { Router, Request, Response, NextFunction } from "express";
import { fiatInSimulator, FiatInMode } from "../simulators/fiatInSimulator.js";
import { payoutSimulator, PayoutMode } from "../simulators/payoutSimulator.js";
import { requireAuth } from "../middleware/auth.js";
import { requireIdempotency } from "../middleware/idempotency.js";

export const simulatorsRouter = Router();

// POST /sim/fiat-in/:transferId: Inbound UAE fiat deposit webhook simulator
// Supports query: ?mode=success | insufficient | timeout
simulatorsRouter.post(
  "/fiat-in/:transferId",
  requireAuth,
  requireIdempotency,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mode = (req.query.mode as FiatInMode) || "success";
      const transferId = req.params.transferId;

      const result = await fiatInSimulator.simulateFiatIn(transferId, mode, req.body);

      res.status(200).json({
        status: "ok",
        simulator: "fiat-in",
        mode,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /sim/payout/:transferId: Outbound INR IMPS/UPI banking payout webhook simulator
// Supports query: ?mode=success | delayed | failed
simulatorsRouter.post(
  "/payout/:transferId",
  requireAuth,
  requireIdempotency,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mode = (req.query.mode as PayoutMode) || "success";
      const transferId = req.params.transferId;

      const result = await payoutSimulator.simulatePayoutWebhook(transferId, mode, req.body);

      res.status(200).json({
        status: "ok",
        simulator: "payout",
        mode,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);
