import { Request } from "express";

/**
 * Organization membership entry attached per-user in the JWT.
 */
export interface IRequestOrg {
  orgId: string;
  role: string;
}

/**
 * User data attached by auth middleware after JWT verification.
 * organizations[] comes from the access token — one entry per org the user belongs to.
 */
export interface IRequestUser {
  userId: string;
  organizations: IRequestOrg[];
}

/**
 * Request type for routes behind authenticate() middleware.
 */
export interface IAuthenticatedRequest extends Request {
  user: IRequestUser;
}

/**
 * Tenant context attached by extractTenant() middleware.
 * Every tenant-scoped query MUST use orgId from this context — never from req.body.
 */
export interface ITenantContext {
  orgId: string;
  userId: string;
  role: string;
}

/**
 * Request type for routes behind authenticate() + extractTenant().
 */
export interface ITenantRequest extends IAuthenticatedRequest {
  tenantContext: ITenantContext;
}
