import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";
import { authenticate } from "../../core/middleware/auth.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from "./auth.validator";

// ─────────────────────────────────────────────────────
// Dependency Assembly (Lightweight DI)
//
// Wiring order: Repository → Service → Controller
// No IoC container needed — just explicit constructor injection.
// Dependencies flow downward, never upward.
//
// The authService instance is exported for cross-domain use:
//   import { authService } from "../auth";
// ─────────────────────────────────────────────────────
const authRepository = new AuthRepository();
export const authService = new AuthService(authRepository);
const authController = new AuthController(authService);

const router = Router();

// ─────────────────────────────────────────────────────
// Public Routes (no authentication required)
// ─────────────────────────────────────────────────────

router.post(
  "/register",
  validate(registerSchema),
  authController.register
);

router.post(
  "/login",
  validate(loginSchema),
  authController.login
);

router.post(
  "/refresh",
  validate(refreshTokenSchema),
  authController.refresh
);

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  "/reset-password/:token",
  validate(resetPasswordSchema),
  authController.resetPassword
);

// ─────────────────────────────────────────────────────
// Protected Routes (authentication required)
// ─────────────────────────────────────────────────────

router.post(
  "/logout",
  authenticate as never,
  authController.logout
);

router.put(
  "/change-password",
  authenticate as never,
  validate(changePasswordSchema),
  authController.changePassword
);

export { router as authRoutes };
