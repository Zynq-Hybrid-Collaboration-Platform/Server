import { Response, NextFunction } from "express";
import { ITenantRequest } from "../types/request.types";
import { AuthorizationError } from "../errors/AuthorizationError";

/**
 * Role hierarchy — higher index = more permissions.
 * A user with a higher-level role implicitly has all lower-level permissions.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  guest: 0,
  viewer: 1,
  member: 2,
  contributor: 3,
  moderator: 4,
  manager: 5,
  admin: 6,
  owner: 7,
  superadmin: 8,
};

/**
 * RBAC middleware factory.
 *
 * Usage:
 *   requireRole("admin")          — single minimum role
 *   requireRole("moderator")      — moderator or above
 *
 * The user's role comes from req.tenantContext.role which was set by extractTenant().
 * Must be placed AFTER extractTenant().
 *
 * Uses hierarchy-based comparison: if the user's role level >= required role level,
 * access is granted. This means "owner" can access "admin" routes, etc.
 */
export function requireRole(minimumRole: string) {
  return (req: ITenantRequest, _res: Response, next: NextFunction): void => {
    const userRole = req.tenantContext?.role;

    if (!userRole) {
      return next(
        new AuthorizationError("No role found — tenant context missing")
      );
    }

    const requiredLevel = ROLE_HIERARCHY[minimumRole];
    const userLevel = ROLE_HIERARCHY[userRole];

    if (requiredLevel === undefined) {
      return next(
        new AuthorizationError(`Unknown required role: ${minimumRole}`)
      );
    }

    if (userLevel === undefined) {
      return next(
        new AuthorizationError(`Unknown user role: ${userRole}`)
      );
    }

    if (userLevel < requiredLevel) {
      return next(
        new AuthorizationError(
          `Insufficient permissions — requires ${minimumRole} or above`
        )
      );
    }

    next();
  };
}
