import { Response, NextFunction } from "express";
import { ITenantRequest } from "../types/request.types";
import { AuthorizationError } from "../errors/AuthorizationError";

export function requireRole(...allowedRoles: string[]) {
  return (req: ITenantRequest, _res: Response, next: NextFunction): void => {
    const userRole = req.tenantContext?.role;

    if (!userRole) {
      return next(
        new AuthorizationError("No role found — tenant context missing"),
      );
    }

    if (userRole === "admin") {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return next(
        new AuthorizationError(
          `Insufficient permissions — requires one of: ${allowedRoles.join(", ")}`,
        ),
      );
    }

    next();
  };
}
