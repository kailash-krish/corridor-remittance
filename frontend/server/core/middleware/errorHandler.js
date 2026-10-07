"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errors_js_1 = require("../utils/errors.js");
const logger_js_1 = require("../utils/logger.js");
const errorHandler = (err, req, res, _next) => {
    const reqLogger = req.log || logger_js_1.logger;
    // 1. Handled application errors
    if (err instanceof errors_js_1.AppError) {
        if (err.statusCode >= 500) {
            reqLogger.error({ err, code: err.code }, err.message);
        }
        else {
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
    if (err instanceof zod_1.ZodError) {
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
    if (err instanceof jsonwebtoken_1.default.JsonWebTokenError || err instanceof jsonwebtoken_1.default.TokenExpiredError) {
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
exports.errorHandler = errorHandler;
