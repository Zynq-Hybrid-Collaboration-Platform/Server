import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { IAuthenticatedRequest } from "../types/request.types";
import { AuthenticationError } from "../errors/AuthenticationError";
import { config } from "../config/env";

/**
 * Access token payload shape.
 * Contains the organizations array — one entry per org the user belongs to.
 */
interface IAccessTokenPayload {
  id: string;
  organizations: Array<{ orgId: string; role: string }>;
}

/**
 * JWT authentication middleware.
 * Verifies access token from Authorization header or httpOnly cookie.
 * Attaches req.user = { userId, organizations } for downstream use.
 *
 * Algorithm restricted to HS256 to prevent algorithm-confusion attacks.
 *
 * Place this BEFORE any route that requires authentication.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Extract token: header takes priority, then cookie
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null) || req.cookies?.accessToken;

  if (!token) {
    return next(new AuthenticationError("No authentication token provided"));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
    }) as IAccessTokenPayload;

    if (!decoded.id) {
      return next(new AuthenticationError("Invalid token payload"));
    }

    (req as IAuthenticatedRequest).user = {
      userId: decoded.id,
      organizations: decoded.organizations ?? [],
    };
    next();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TokenExpiredError") {
      return next(new AuthenticationError("Token has expired"));
    }
    return next(new AuthenticationError("Invalid authentication token"));
  }
}
