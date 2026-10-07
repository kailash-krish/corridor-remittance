"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
const errors_js_1 = require("../utils/errors.js");
/**
 * Validates Supabase JWT from the Authorization header and attaches req.user
 */
function requireAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new errors_js_1.UnauthorizedError("Missing or malformed Authorization header");
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_js_1.env.SUPABASE_JWT_SECRET);
        if (!decoded.sub) {
            throw new errors_js_1.UnauthorizedError("Invalid token payload: missing subject identifier");
        }
        // Role priority: app_metadata.role -> user_metadata.role -> standard JWT role claim
        const role = decoded.app_metadata?.role ||
            decoded.user_metadata?.role ||
            decoded.role ||
            "authenticated";
        req.user = {
            id: decoded.sub,
            email: decoded.email,
            role,
            metadata: {
                ...decoded.app_metadata,
                ...decoded.user_metadata
            }
        };
        next();
    }
    catch (err) {
        if (err instanceof errors_js_1.UnauthorizedError) {
            next(err);
            return;
        }
        // Re-throw JWT errors (JsonWebTokenError, TokenExpiredError) to be handled by errorHandler
        next(err);
    }
}
/**
 * Enforces admin authorization for sensitive actions (e.g. AML decisions)
 */
function requireAdmin(req, _res, next) {
    if (!req.user) {
        throw new errors_js_1.UnauthorizedError("Authentication required before authorization check");
    }
    if (req.user.role !== "admin") {
        throw new errors_js_1.ForbiddenError("Admin privileges required to perform this action");
    }
    next();
}
