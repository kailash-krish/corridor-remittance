"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidTransitionError = exports.IdempotencyConflictError = exports.ConflictError = exports.ValidationError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class BadRequestError extends AppError {
    constructor(message = "Bad request", details) {
        super(message, 400, "BAD_REQUEST", details);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", details) {
        super(message, 401, "UNAUTHORIZED", details);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = "Forbidden", details) {
        super(message, 403, "FORBIDDEN", details);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(message = "Resource not found", details) {
        super(message, 404, "NOT_FOUND", details);
    }
}
exports.NotFoundError = NotFoundError;
class ValidationError extends AppError {
    constructor(message = "Validation failed", details) {
        super(message, 400, "VALIDATION_ERROR", details);
    }
}
exports.ValidationError = ValidationError;
class ConflictError extends AppError {
    constructor(message = "Resource conflict", details) {
        super(message, 409, "CONFLICT", details);
    }
}
exports.ConflictError = ConflictError;
class IdempotencyConflictError extends AppError {
    constructor(message = "Idempotency key was previously used with a different request payload", details) {
        super(message, 409, "IDEMPOTENCY_CONFLICT", details);
    }
}
exports.IdempotencyConflictError = IdempotencyConflictError;
class InvalidTransitionError extends AppError {
    constructor(fromStatus, toStatus, allowed) {
        super(`Illegal state transition from ${fromStatus} to ${toStatus}. Permitted transitions: [${allowed.join(", ")}]`, 400, "INVALID_STATE_TRANSITION", { fromStatus, toStatus, allowed });
    }
}
exports.InvalidTransitionError = InvalidTransitionError;
