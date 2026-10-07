import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { amlService } from "../services/amlService.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { BadRequestError } from "../utils/errors.js";

export const adminAmlRouter = Router();

// Apply auth + admin role protection across all /admin/aml routes
adminAmlRouter.use(requireAuth, requireAdmin);

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().min(3, "Compliance decision must include an explanatory note")
});

// GET /admin/aml/queue: List pending compliance reviews
adminAmlRouter.get("/queue", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const queue = await amlService.getPendingQueue();
    res.status(200).json({
      data: queue
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/aml/:id: Get specific AML flag with detailed transfer info
adminAmlRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const details = await amlService.getFlagDetails(req.params.id);
    res.status(200).json({
      data: details
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/aml/:id/decision: Admin approves or rejects flagged transfer
adminAmlRouter.post(
  "/:id/decision",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      if (!req.user) {
        throw new BadRequestError("Admin user required");
      }

      const result = await amlService.processAdminDecision(
        req.params.id,
        req.user.id,
        parsed.data.decision,
        parsed.data.note
      );

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);
