import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "../db/repository.js";
import { IdempotencyConflictError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Idempotency Middleware.
 * Prevents double-spend and duplicate state transitions.
 * If repeated with exact same payload, replays cached response.
 * If repeated with mismatched payload, rejects with 409 Conflict.
 */
export async function requireIdempotency(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const idempotencyKey =
    (req.headers["idempotency-key"] as string) ||
    (req.headers["x-idempotency-key"] as string);

  // If client didn't supply an Idempotency-Key, proceed normally
  if (!idempotencyKey) {
    next();
    return;
  }

  const userId = req.user?.id || "anonymous";
  const requestPath = `${req.method}:${req.originalUrl}`;
  const requestParamsHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(req.body || {}))
    .digest("hex");

  try {
    const existing = await db.idempotency.findByKey(userId, idempotencyKey);

    if (existing) {
      // 1. Conflict detection: Same key with different payload
      if (existing.request_params_hash !== requestParamsHash) {
        logger.warn(
          { userId, idempotencyKey, path: requestPath },
          "Idempotency conflict detected: reused key with different payload"
        );
        throw new IdempotencyConflictError();
      }

      // 2. Exact match: Replay cached response
      logger.info(
        { userId, idempotencyKey, path: requestPath },
        "Replaying cached idempotent response"
      );
      res.setHeader("Idempotent-Replay", "true");
      res.status(existing.response_code || 200).json(existing.response_body);
      return;
    }

    // 3. New key: Intercept response to capture and store body
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Save completed response in background
      db.idempotency.save({
        id: crypto.randomUUID(),
        key: idempotencyKey,
        user_id: userId,
        request_path: requestPath,
        request_params_hash: requestParamsHash,
        response_code: res.statusCode,
        response_body: body,
        locked_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }).catch((err) => {
        logger.error({ err, idempotencyKey }, "Failed to record idempotency key");
      });

      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
}
