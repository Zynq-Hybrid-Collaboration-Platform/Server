import { Router } from "express";
import passport from "passport";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/login-org", validate(loginSchema), authController.loginOrg);
router.post("/refresh", validate(refreshTokenSchema), authController.refresh);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password/:token", validate(resetPasswordSchema), authController.resetPassword);

router.post("/logout", authenticate as never, authController.logout);
router.put("/change-password", authenticate as never, validate(changePasswordSchema), authController.changePassword);
router.get("/me", authenticate as never, authController.getMe);

// Google Auth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login", session: false }), authController.googleCallback);

export { router as authRoutes };
