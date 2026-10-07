export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(
    message = "Idempotency key was previously used with a different request payload",
    details?: unknown
  ) {
    super(message, 409, "IDEMPOTENCY_CONFLICT", details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(fromStatus: string, toStatus: string, allowed: readonly string[]) {
    super(
      `Illegal state transition from ${fromStatus} to ${toStatus}. Permitted transitions: [${allowed.join(", ")}]`,
      400,
      "INVALID_STATE_TRANSITION",
      { fromStatus, toStatus, allowed }
    );
  }
}
