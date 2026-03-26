import { Response, NextFunction } from "express";
import {
  IAuthenticatedRequest,
  ITenantRequest,
} from "../types/request.types";
import { AuthorizationError } from "../errors/AuthorizationError";
import { ValidationError } from "../errors/ValidationError";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

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

  const membership = req.user.organizations.find((o) => o.orgId === orgId);

  if (!membership) {
    return next(
      new AuthorizationError("You do not have access to this organization")
    );
  }

  (req as ITenantRequest).tenantContext = {
    orgId,
    userId: req.user.userId,
    role: membership.role,
  };

  next();
}
