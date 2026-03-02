// ─────────────────────────────────────────────────────
// Auth Domain — Public API
//
// This barrel file is the ONLY import path other modules should use.
// Do NOT import auth.model.ts, auth.repository.ts, etc. from outside auth/.
// ─────────────────────────────────────────────────────

export { authRoutes, authService } from "./auth.routes";
export { AuthService } from "./auth.service";
export type { IAuthServiceInterface, IUserSafe } from "./auth.types";
