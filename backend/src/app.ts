import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { healthRouter } from "./routes/health.js";
import { quotesRouter } from "./routes/quotes.js";
import { kycRouter } from "./routes/kyc.js";
import { transfersRouter } from "./routes/transfers.js";
import { simulatorsRouter } from "./routes/simulators.js";
import { adminAmlRouter } from "./routes/adminAml.js";
import { notificationsRouter } from "./routes/notifications.js";
import { NotFoundError } from "./utils/errors.js";

export function createApp(): Express {
  const app = express();

  // Basic security and parsing middlewares
  app.use(cors());
  app.use(express.json());

  // Structured logging with unique request-id
  app.use(requestLogger);

  // Core endpoints
  app.use("/health", healthRouter);
  app.use("/quotes", quotesRouter);
  app.use("/kyc", kycRouter);
  app.use("/transfers", transfersRouter);
  app.use("/sim", simulatorsRouter);
  app.use("/admin/aml", adminAmlRouter);
  app.use("/notifications", notificationsRouter);

  // Auth inspection endpoints (used for testing and user context checks)
  app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    res.status(200).json({
      user: req.user
    });
  });

  // Admin-protected endpoint
  app.get("/api/admin/ping", requireAuth, requireAdmin, (_req: Request, res: Response) => {
    res.status(200).json({
      message: "Admin access granted"
    });
  });

  // 404 handler for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
