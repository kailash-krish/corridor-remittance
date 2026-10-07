import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/repository.js";
import { transferOrchestrator } from "../orchestrator/transferOrchestrator.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireIdempotency } from "../middleware/idempotency.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

export const transfersRouter = Router();

const createTransferSchema = z.object({
  quoteId: z.string().uuid(),
  senderAccountId: z.string().optional(),
  recipientDetails: z.object({
    name: z.string().min(2),
    account_number: z.string().optional(),
    ifsc: z.string().optional(),
    upi_id: z.string().optional(),
    bank_name: z.string().optional(),
    country: z.string().default("IND")
  })
});

const amlReviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().optional()
});

// POST /transfers: Create transfer referencing quote (idempotent)
transfersRouter.post(
  "/",
  requireAuth,
  requireIdempotency,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      if (!req.user) {
        throw new BadRequestError("Authenticated user required");
      }

      const transfer = await transferOrchestrator.createTransfer({
        userId: req.user.id,
        quoteId: parsed.data.quoteId,
        senderAccountId: parsed.data.senderAccountId,
        recipientDetails: parsed.data.recipientDetails
      });

      res.status(201).json({
        data: transfer
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /transfers: List user's transfers
transfersRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new BadRequestError("Authenticated user required");
      }

      const userTransfers = await db.transfers.findByUserId(req.user.id);
      res.status(200).json({
        data: userTransfers
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /transfers/:id: Transfer details with event history
transfersRouter.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transfer = await db.transfers.findById(req.params.id);
      if (!transfer) {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      // Check ownership (or admin role)
      if (req.user?.role !== "admin" && transfer.user_id !== req.user?.id) {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      const events = await db.events.findByTransferId(transfer.id);

      res.status(200).json({
        data: {
          ...transfer,
          events
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /transfers/:id/events: Dedicated audit events history
transfersRouter.get(
  "/:id/events",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transfer = await db.transfers.findById(req.params.id);
      if (!transfer) {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      if (req.user?.role !== "admin" && transfer.user_id !== req.user?.id) {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      const events = await db.events.findByTransferId(transfer.id);
      res.status(200).json({
        data: events
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /transfers/:id/cancel: User cancels transfer if allowed
transfersRouter.post(
  "/:id/cancel",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transfer = await db.transfers.findById(req.params.id);
      if (!transfer) {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      if (transfer.user_id !== req.user?.id && req.user?.role !== "admin") {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      const updated = await transferOrchestrator.advance(transfer.id, {
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
    } catch (err) {
      next(err);
    }
  }
);

// POST /transfers/:id/deposit: Simulates UAE bank funds deposit
transfersRouter.post(
  "/:id/deposit",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transfer = await db.transfers.findById(req.params.id);
      if (!transfer) {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      if (transfer.user_id !== req.user?.id && req.user?.role !== "admin") {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      const updated = await transferOrchestrator.advance(transfer.id, {
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
    } catch (err) {
      next(err);
    }
  }
);

// POST /transfers/:id/aml-review: Admin decision for AML_REVIEW status
transfersRouter.post(
  "/:id/aml-review",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = amlReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const transfer = await db.transfers.findById(req.params.id);
      if (!transfer) {
        throw new NotFoundError(`Transfer not found: ${req.params.id}`);
      }

      if (transfer.status !== "AML_REVIEW") {
        throw new BadRequestError(
          `Cannot review transfer in status: ${transfer.status}. Must be in AML_REVIEW.`
        );
      }

      // Update AML Flag
      const flag = await db.aml.findByTransferId(transfer.id);
      if (flag) {
        await db.aml.update(flag.id, {
          status: parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decision_notes: parsed.data.notes || null,
          reviewed_by: req.user?.id,
          reviewed_at: new Date().toISOString()
        });
      }

      // Advance transfer
      const targetStatus = parsed.data.decision === "APPROVE" ? "CONVERTING" : "REJECTED";
      const eventName =
        parsed.data.decision === "APPROVE"
          ? "AML_MANUAL_REVIEW_APPROVED"
          : "AML_MANUAL_REVIEW_REJECTED";

      const updated = await transferOrchestrator.advance(transfer.id, {
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
    } catch (err) {
      next(err);
    }
  }
);
