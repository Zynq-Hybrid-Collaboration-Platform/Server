import { Response, NextFunction } from "express";
import {
  IAuthenticatedRequest,
  ITenantRequest,
} from "../types/request.types";
import { AuthorizationError } from "../errors/AuthorizationError";
import { ValidationError } from "../errors/ValidationError";

/** MongoDB ObjectId format */
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * Tenant extraction middleware.
 *
 * Reads the target organization from:
 *   1. X-Org-ID header (preferred — set by frontend)
 *   2. :orgId route parameter (fallback — for REST-style URLs)
 *
 * Then validates that the authenticated user actually belongs to that org
 * by checking the organizations[] array in the JWT payload.
 *
 * On success, attaches req.tenantContext = { orgId, userId, role }.
 *
 * Must be placed AFTER authenticate() — requires req.user.
 */
export function extractTenant(
  req: IAuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const orgId =
    (req.headers["x-org-id"] as string | undefined) || req.params.orgId;

  if (!orgId) {
    return next(
      new ValidationError(
        "Organization ID is required (X-Org-ID header or :orgId param)"
      )
    );
  }

  if (!OBJECT_ID_RE.test(orgId)) {
    return next(new ValidationError("Organization ID must be a valid identifier"));
  }

  // Verify the user actually belongs to this org
  const membership = req.user.organizations.find((o) => o.orgId === orgId);

  if (!membership) {
    return next(
      new AuthorizationError("You do not have access to this organization")
    );
  }

  // Attach tenant context for downstream handlers
  (req as ITenantRequest).tenantContext = {
    orgId,
    userId: req.user.userId,
    role: membership.role,
  };

  next();
}
