"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireIdempotency = requireIdempotency;
const node_crypto_1 = __importDefault(require("node:crypto"));
const repository_js_1 = require("../db/repository.js");
const errors_js_1 = require("../utils/errors.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Idempotency Middleware.
 * Prevents double-spend and duplicate state transitions.
 * If repeated with exact same payload, replays cached response.
 * If repeated with mismatched payload, rejects with 409 Conflict.
 */
async function requireIdempotency(req, res, next) {
    const idempotencyKey = req.headers["idempotency-key"] ||
        req.headers["x-idempotency-key"];
    // If client didn't supply an Idempotency-Key, proceed normally
    if (!idempotencyKey) {
        next();
        return;
    }
    const userId = req.user?.id || "anonymous";
    const requestPath = `${req.method}:${req.originalUrl}`;
    const requestParamsHash = node_crypto_1.default
        .createHash("sha256")
        .update(JSON.stringify(req.body || {}))
        .digest("hex");
    try {
        const existing = await repository_js_1.db.idempotency.findByKey(userId, idempotencyKey);
        if (existing) {
            // 1. Conflict detection: Same key with different payload
            if (existing.request_params_hash !== requestParamsHash) {
                logger_js_1.logger.warn({ userId, idempotencyKey, path: requestPath }, "Idempotency conflict detected: reused key with different payload");
                throw new errors_js_1.IdempotencyConflictError();
            }
            // 2. Exact match: Replay cached response
            logger_js_1.logger.info({ userId, idempotencyKey, path: requestPath }, "Replaying cached idempotent response");
            res.setHeader("Idempotent-Replay", "true");
            res.status(existing.response_code || 200).json(existing.response_body);
            return;
        }
        // 3. New key: Intercept response to capture and store body
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // Save completed response in background
            repository_js_1.db.idempotency.save({
                id: node_crypto_1.default.randomUUID(),
                key: idempotencyKey,
                user_id: userId,
                request_path: requestPath,
                request_params_hash: requestParamsHash,
                response_code: res.statusCode,
                response_body: body,
                locked_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            }).catch((err) => {
                logger_js_1.logger.error({ err, idempotencyKey }, "Failed to record idempotency key");
            });
            return originalJson(body);
        };
        next();
    }
    catch (err) {
        next(err);
    }
}
