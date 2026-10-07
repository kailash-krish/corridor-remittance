import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

export interface AuthUser {
  id: string;
  email?: string;
  role: string;
  metadata?: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface SupabaseJwtPayload extends jwt.JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  app_metadata?: {
    role?: string;
    [key: string]: unknown;
  };
  user_metadata?: {
    role?: string;
    [key: string]: unknown;
  };
}

/**
 * Validates Supabase JWT from the Authorization header and attaches req.user
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as SupabaseJwtPayload;

    if (!decoded.sub) {
      throw new UnauthorizedError("Invalid token payload: missing subject identifier");
    }

    // Role priority: app_metadata.role -> user_metadata.role -> standard JWT role claim
    const role =
      decoded.app_metadata?.role ||
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
  } catch (err) {
    if (err instanceof UnauthorizedError) {
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
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required before authorization check");
  }

  if (req.user.role !== "admin") {
    throw new ForbiddenError("Admin privileges required to perform this action");
  }

  next();
}
