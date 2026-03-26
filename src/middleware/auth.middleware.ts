import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { IAuthenticatedRequest } from "../types/request.types";
import { AuthenticationError } from "../errors/AuthenticationError";
import { config } from "../config/env";

interface IAccessTokenPayload {
  id: string;
  organizations: Array<{ orgId: string; role: string }>;
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
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
