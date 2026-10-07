import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const reqLogger = req.log || logger;

  // 1. Handled application errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      reqLogger.error({ err, code: err.code }, err.message);
    } else {
      reqLogger.warn({ code: err.code, details: err.details }, err.message);
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null
      }
    });
    return;
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    reqLogger.warn({ errors: err.errors }, "Validation error");
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.flatten()
      }
    });
    return;
  }

  // 3. JWT verification errors
  if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    reqLogger.warn({ err }, "JWT authentication error");
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: err.message || "Invalid or expired token",
        details: null
      }
    });
    return;
  }

  // 4. Unhandled server errors (500)
  reqLogger.error({ err }, "Unhandled server error");
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      details: null
    }
  });
};
