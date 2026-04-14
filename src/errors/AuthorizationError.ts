import { AppError } from "./AppError";

/**
 * user is authenticated but lacks permission.
 * Used by: RBAC middleware, tenant middleware, domain ownership checks.
 */
export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}
