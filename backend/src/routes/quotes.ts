import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { fxService } from "../services/fxService.js";
import { quoteService } from "../services/quoteService.js";
import { requireAuth } from "../middleware/auth.js";
import { BadRequestError } from "../utils/errors.js";

export const quotesRouter = Router();

const createQuoteSchema = z.object({
  sourceCurrency: z.string().min(3).max(3),
  targetCurrency: z.string().min(3).max(3),
  // Integer minor units (e.g. 10000 = 100.00 AED)
  sendAmountMinor: z.number().int().safe().positive()
});

// Public estimate uses the same calculator as the locked quote, without saving visitor data.
quotesRouter.get('/estimate', async (req,res,next)=>{
  try {
    const parsed=createQuoteSchema.parse({sourceCurrency:req.query.source,targetCurrency:req.query.target,sendAmountMinor:Number(req.query.amount)});
    res.json({data:await fxService.calculateQuote(parsed.sourceCurrency,parsed.targetCurrency,parsed.sendAmountMinor)});
  } catch(error){next(error)}
});
// POST /quotes: Create locked FX quote
quotesRouter.post(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createQuoteSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      if (!req.user) {
        throw new BadRequestError("Authenticated user required");
      }

      const quote = await quoteService.createQuote({
        userId: req.user.id,
        sourceCurrency: parsed.data.sourceCurrency,
        targetCurrency: parsed.data.targetCurrency,
        sendAmountMinor: parsed.data.sendAmountMinor
      });

      res.status(201).json({
        data: quote
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /quotes: List user's quotes
quotesRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new BadRequestError("Authenticated user required");
      }

      const quotes = await quoteService.getUserQuotes(req.user.id);
      res.status(200).json({
        data: quotes
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /quotes/:id: Retrieve quote details and expiry status
quotesRouter.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quote = await quoteService.getQuote(req.params.id);
      if(quote.user_id!==req.user?.id)throw new BadRequestError("Quote unavailable.");
      res.status(200).json({
        data: quote
      });
    } catch (err) {
      next(err);
    }
  }
);
