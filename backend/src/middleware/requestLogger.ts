import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { logger } from "../utils/logger.js";

// Extend Express Request type to include request id and child logger
declare global {
  namespace Express {
    interface Request {
      id: string;
      log: typeof logger;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  req.log = logger.child({ requestId });

  req.log.debug({ method: req.method, url: req.url }, "Incoming request");

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    req.log.info(
      {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: duration
      },
      "Request completed"
    );
  });

  next();
}
