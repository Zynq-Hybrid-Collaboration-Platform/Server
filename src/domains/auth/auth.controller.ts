import { Request, Response } from "express";
import { Profile } from "passport-google-oauth20";
import { AuthService } from "./auth.service";
import { catchAsync } from "../../core/middleware/async-handler";
import { sendSuccess } from "../../core/utils/response";
import { IAuthenticatedRequest } from "../../core/types/request.types";
import { config } from "../../core/config/env";

/**
 * Auth Controller — HTTP layer only.
 *
 * Rules:
 * - Extract validated data from req.body / req.params / req.cookies
 * - Call the appropriate AuthService method
 * - Format the HTTP response (status code, cookies, JSON body)
 * - ZERO business logic
 * - ZERO database calls
 * - ZERO password hashing or JWT generation
 *
 * Every method is wrapped in catchAsync — no try/catch needed.
 * Errors thrown by the service are caught and forwarded to globalErrorHandler.
 */

/**
 * Refresh token cookie options — path-scoped to /api/v1/auth.
 * sameSite strict prevents CSRF. httpOnly prevents XSS.
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction(),
  sameSite: "strict" as const,
  path: "/api/v1/auth",
};

/** Access token cookie — broader path, lax sameSite for nav requests */
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction(),
  sameSite: "lax" as const,
};

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * POST /api/v1/auth/register
   * Public — no auth required.
   *
   * Returns 201 with accessToken in body (for immediate use).
   * refreshToken is set as httpOnly cookie only (never in response body).
   */
  register = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, username, organizationId } = req.body;

    const result = await this.authService.register({
      name,
      email,
      password,
      username,
      organizationId,
    });

    // refreshToken goes ONLY in httpOnly cookie — never in response body
    res.cookie(
      "refreshToken",
      result.tokens.refreshToken,
      REFRESH_COOKIE_OPTIONS
    );
    res.cookie(
      "accessToken",
      result.tokens.accessToken,
      ACCESS_COOKIE_OPTIONS
    );

    sendSuccess(
      res,
      {
        message: "User registered successfully",
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
      201
    );
  });

  /**
   * POST /api/v1/auth/register-user
   * Public — no auth required.
   *
   * Organization-linked registration. The caller must supply a valid
   * organizationCode (ORG-XXXXXX) obtained from POST /api/v1/organizations/register.
   *
   * Delegates entirely to authService.register() which:
   *   1. Validates the code against the database.
   *   2. Creates the User and Member records atomically inside a transaction.
   *   3. Issues access + refresh token pair.
   */
  registerUserWithOrg = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { name, email, password, username, organizationCode } = req.body;

      const result = await this.authService.register({
        name,
        email,
        password,
        username,
        organizationCode,
      });

      res.cookie(
        "refreshToken",
        result.tokens.refreshToken,
        REFRESH_COOKIE_OPTIONS,
      );
      res.cookie(
        "accessToken",
        result.tokens.accessToken,
        ACCESS_COOKIE_OPTIONS,
      );

      sendSuccess(
        res,
        {
          message: "User registered successfully",
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
        201,
      );
    },
  );

  /**
   * POST /api/v1/auth/login
   * Public — no auth required.
   *
   * Sets refreshToken as httpOnly cookie (path-scoped to /api/v1/auth).
   * Returns accessToken in body for frontend storage.
   */
  login = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const result = await this.authService.login({ email, password });

    res.cookie(
      "refreshToken",
      result.tokens.refreshToken,
      REFRESH_COOKIE_OPTIONS
    );
    res.cookie(
      "accessToken",
      result.tokens.accessToken,
      ACCESS_COOKIE_OPTIONS
    );

    sendSuccess(res, {
      message: "Logged in successfully",
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  });

  /**
   * POST /api/v1/auth/refresh
   * Public — uses refresh token from cookie or body.
   *
   * Rotates refresh token on every use (old one is invalidated).
   */
  refresh = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const refreshToken =
      req.cookies?.refreshToken || req.body.refreshToken;

    const tokens = await this.authService.refreshToken({ refreshToken });

    res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);

    sendSuccess(res, {
      message: "Tokens refreshed successfully",
      accessToken: tokens.accessToken,
    });
  });

  /**
   * POST /api/v1/auth/logout
   * Protected — requires valid access token.
   *
   * Clears cookies AND invalidates refresh token in DB.
   */
  logout = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthenticatedRequest;
    await this.authService.logout(authReq.user.userId);

    res.clearCookie("accessToken", ACCESS_COOKIE_OPTIONS);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);

    sendSuccess(res, { message: "Logged out successfully" });
  });

  /**
   * PUT /api/v1/auth/change-password
   * Protected — requires valid access token.
   *
   * Uses userId from JWT (not email from body — more secure).
   * Invalidates refresh token on success (forces re-login).
   */
  changePassword = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const { currentPassword, newPassword } = req.body;

      await this.authService.changePassword(authReq.user.userId, {
        currentPassword,
        newPassword,
      });

      // Clear cookies — user must re-login with new password
      res.clearCookie("accessToken", ACCESS_COOKIE_OPTIONS);
      res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);

      sendSuccess(res, { message: "Password changed successfully" });
    }
  );

  /**
   * POST /api/v1/auth/forgot-password
   * Public — rate limited recommended.
   *
   * Always returns success message (don't reveal if email exists).
   */
  forgotPassword = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = req.body;

      // Service sends the reset email internally — we don't expose the token
      await this.authService.forgotPassword({ email });

      sendSuccess(res, {
        message:
          "If an account with that email exists, a password reset link has been sent",
      });
    }
  );

  /**
   * POST /api/v1/auth/reset-password/:token
   * Public — token is validated against DB.
   *
   * Resets password and invalidates all sessions (refresh token cleared).
   */
  resetPassword = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { token } = req.params;
      const { newPassword } = req.body;

      await this.authService.resetPassword({ token, newPassword });

      sendSuccess(res, { message: "Password has been reset successfully" });
    }
  );

  googleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const profile = req.user as Profile;

      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const avatar = profile.photos?.[0]?.value;

      if (!email) {
        res.redirect(`${config.FRONTEND_URL}/oauth-error?reason=no_email`);
        return;
      }

      const result = await this.authService.googleLogin({ googleId, email, name, avatar });

      res.cookie("refreshToken", result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.cookie("accessToken", result.tokens.accessToken, ACCESS_COOKIE_OPTIONS);

      res.redirect(`${config.FRONTEND_URL}/oauth-success?token=${result.tokens.accessToken}`);
    } catch {
      res.redirect(`${config.FRONTEND_URL}/oauth-error`);
    }
  };

  getCurrentUser = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthenticatedRequest;
    const user = await this.authService.findUserById(authReq.user.userId);
    sendSuccess(res, { user });
  });
}
