import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { kycService } from "../services/kycService.js";
import { requireAuth } from "../middleware/auth.js";
import { BadRequestError } from "../utils/errors.js";

export const kycRouter = Router();

const submitKycSchema = z.object({
  fullName: z.string().min(2).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  idType: z.enum(["PASSPORT", "NATIONAL_ID", "RESIDENCE_VISA", "DRIVING_LICENSE"]),
  idNumber: z.string().min(4).max(50),
  country: z.string().min(2).max(3)
});

// POST /kyc/submit: Submit identity verification payload
kycRouter.post(
  "/submit",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = submitKycSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      if (!req.user) {
        throw new BadRequestError("Authenticated user required");
      }

      const result = await kycService.submitKyc(req.user.id, {
        fullName: parsed.data.fullName,
        dateOfBirth: parsed.data.dateOfBirth,
        idType: parsed.data.idType,
        idNumber: parsed.data.idNumber,
        country: parsed.data.country
      });

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /kyc/status: Retrieve current KYC verification status
kycRouter.get(
  "/status",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new BadRequestError("Authenticated user required");
      }

      const statusResponse = await kycService.getKycStatus(req.user.id);

      res.status(200).json({
        data: statusResponse
      });
    } catch (err) {
      next(err);
    }
  }
);
