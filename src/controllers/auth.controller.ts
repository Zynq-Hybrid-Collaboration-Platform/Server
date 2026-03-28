import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { UserModel } from "../models/auth.model";
import Workspace from "../models/workspace.model";
import { Organization, IOrganization } from "../models/organization.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { IAuthenticatedRequest } from "../types/request.types";
import { config } from "../config/env";
import { logger } from "../logger/logger";
import { emailService } from "../utils/email";
import {
  IUserSafe,
  IUserLean,
  IAuthTokens,
} from "../types/auth.types";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../errors";

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000;

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction(),
  sameSite: "strict" as const,
  path: "/api/v1/auth",
};

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction(),
  sameSite: "lax" as const,
};

// Private Helpers

// Create JWT access and refresh tokens
function generateTokenPair(userId: string, organizations: any[]): IAuthTokens {
  const orgs = organizations.map((o) => ({
    orgId: o.orgId.toString(),
    role: o.role,
  }));

  const accessToken = jwt.sign(
    { id: userId, organizations: orgs },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES as any, algorithm: "HS256" }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES as any, algorithm: "HS256" }
  );

  return { accessToken, refreshToken };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Remove sensitive fields from user object
function sanitizeUser(user: any): IUserSafe {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    status: user.status,
    organizations: (user.organizations || []).map((o: any) => ({
      orgId: o.orgId.toString(),
      role: o.role,
      joinedAt: o.joinedAt.toISOString(),
    })),
    workspaces: (user.workspaces || []).map((w: any) => ({
      workspaceId: w.workspaceId.toString(),
      name: w.name,
      joinedAt: w.joinedAt.toISOString(),
    })),
  };
}

// Helpers
const findUser = (id: string) => UserModel.findById(id).lean();
const findOrg = (id: string) => Organization.findById(id).lean();

// HTTP Handlers

export const register = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, username } = req.body;

  const [emailExists, usernameExists] = await Promise.all([
    UserModel.countDocuments({ email }).then(c => c > 0),
    UserModel.countDocuments({ username }).then(c => c > 0),
  ]);

  if (emailExists) throw new ConflictError("User already exists");
  if (usernameExists) throw new ConflictError("Username is already taken");

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await UserModel.create({
    name,
    email,
    username,
    password: hashedPassword,
    organizations: [],
    workspaces: [],
  });

  const tokens = generateTokenPair(user._id.toString(), user.organizations);

  const hashedRefresh = hashToken(tokens.refreshToken);
  await UserModel.findByIdAndUpdate(user._id, { refreshToken: hashedRefresh });

  logger.info("User registered", { userId: user._id, email: user.email });

  emailService.sendWelcomeEmail(user.email, user.name)
    .catch((err) => logger.error("Failed to send welcome email", { err }));

  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);

  sendSuccess(res, {
    message: "User registered successfully",
    user: sanitizeUser(user),
    accessToken: tokens.accessToken,
  }, 201);
});

export const login = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({ email }).select("+password").lean<IUserLean>();

  if (!user) throw new AuthenticationError("Invalid email or password");
  if (!user.password) throw new AuthenticationError("This account uses Google login. Please sign in with Google.");

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new AuthenticationError("Invalid email or password");

  const tokens = generateTokenPair(user._id.toString(), user.organizations);

  const hashedRefresh = hashToken(tokens.refreshToken);
  await UserModel.findByIdAndUpdate(user._id, { refreshToken: hashedRefresh });

  logger.info("User logged in", { userId: user._id });

  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);

  sendSuccess(res, {
    message: "Logged in successfully",
    user: sanitizeUser(user),
    accessToken: tokens.accessToken,
  });
});

export const loginOrg = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const org = await Organization.findOne({ email }).select("+password").lean<IOrganization>();

  if (!org) throw new AuthenticationError("Invalid email or password");

  const isPasswordValid = await bcrypt.compare(password, org.password);
  if (!isPasswordValid) throw new AuthenticationError("Invalid email or password");

  const orgIdStr = org._id.toString();
  const fakeOrganizations = [{ orgId: org._id, role: "admin", joinedAt: org.createdAt || new Date() }];

  const tokens = generateTokenPair(orgIdStr, fakeOrganizations);

  logger.info("Organization logged in as Founder", { orgId: orgIdStr });

  const workspaces = await Workspace.find({ orgId: org._id });

  const mockedUserSafe = {
    id: orgIdStr,
    name: org.name,
    email: org.email,
    username: org.name.replace(/\s+/g, "").toLowerCase(),
    avatar: "",
    status: "online",
    organizations: [
      {
        orgId: orgIdStr,
        role: "admin",
        joinedAt: (org.createdAt || new Date()).toISOString(),
      },
    ],
    workspaces: workspaces.map(w => ({
      workspaceId: w._id.toString(),
      name: w.name,
      joinedAt: w.createdAt.toISOString()
    }))
  };

  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);

  sendSuccess(res, {
    message: "Organization logged in successfully",
    user: mockedUserSafe,
    accessToken: tokens.accessToken,
  });
});

export const refresh = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!refreshToken) throw new AuthenticationError("Refresh token is required");

  let decoded: { id: string };
  try {
    decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET, { algorithms: ["HS256"] }) as { id: string };
  } catch {
    throw new AuthenticationError("Invalid or expired refresh token");
  }

  const user = await UserModel.findById(decoded.id).select("+refreshToken").lean<IUserLean>();
  if (!user) throw new AuthenticationError("User not found");

  const incomingHash = hashToken(refreshToken);
  if (user.refreshToken && user.refreshToken !== incomingHash) {
    await UserModel.findByIdAndUpdate(user._id, { refreshToken: null });
    logger.warn("Refresh token reuse detected — all sessions invalidated", { userId: user._id });
    throw new AuthenticationError("Refresh token has been revoked — please log in again");
  }

  const tokens = generateTokenPair(user._id.toString(), user.organizations);

  const newHashedRefresh = hashToken(tokens.refreshToken);
  await UserModel.findByIdAndUpdate(user._id, { refreshToken: newHashedRefresh });

  logger.debug("Tokens refreshed", { userId: user._id });

  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);

  sendSuccess(res, {
    message: "Tokens refreshed successfully",
    accessToken: tokens.accessToken,
  });
});

export const logout = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const authReq = req as IAuthenticatedRequest;
  
  await UserModel.findByIdAndUpdate(authReq.user.userId, { refreshToken: null });
  logger.info("User logged out", { userId: authReq.user.userId });

  res.clearCookie("accessToken", ACCESS_COOKIE_OPTIONS);
  res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);

  sendSuccess(res, { message: "Logged out successfully" });
});

export const changePassword = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const authReq = req as IAuthenticatedRequest;
  const { currentPassword, newPassword } = req.body;
  const userId = authReq.user.userId;

  if (currentPassword === newPassword) {
    throw new ValidationError("New password must be different from current password");
  }

  const user = await UserModel.findById(userId).select("+password").lean<IUserLean>();
  if (!user) throw new NotFoundError("User");
  if (!user.password) throw new AuthenticationError("This account uses Google login. You cannot change your password here.");

  const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentValid) throw new AuthenticationError("Current password does not match");

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserModel.findByIdAndUpdate(user._id, { password: hashedPassword, refreshToken: null });

  logger.info("Password changed", { userId });

  res.clearCookie("accessToken", ACCESS_COOKIE_OPTIONS);
  res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);

  sendSuccess(res, { message: "Password changed successfully" });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email }).lean<IUserLean>();

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedTokenVal = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);

    await UserModel.findByIdAndUpdate(user._id, {
      resetPasswordToken: hashedTokenVal,
      resetPasswordExpires: expires,
    });

    logger.info("Password reset token generated", { userId: user._id });
    await emailService.sendPasswordResetEmail(user.email, rawToken, user.name);
  } else {
    logger.debug("Forgot password request for non-existent email", { email });
  }

  sendSuccess(res, {
    message: "If an account with that email exists, a password reset link has been sent",
  });
});

export const resetPassword = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const hashedTokenVal = crypto.createHash("sha256").update(token).digest("hex");

  const user = await UserModel.findOne({
    resetPasswordToken: hashedTokenVal,
    resetPasswordExpires: { $gt: new Date() },
  })
    .select("+resetPasswordToken +resetPasswordExpires")
    .lean<IUserLean>();

  if (!user) throw new AuthenticationError("Invalid or expired reset token");

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await UserModel.findByIdAndUpdate(user._id, { 
    password: hashedPassword,
    refreshToken: null,
    $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 }
  });

  logger.info("Password reset completed", { userId: user._id });

  sendSuccess(res, { message: "Password has been reset successfully" });
});

export const getMe = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const authReq = req as IAuthenticatedRequest;
  const userId = authReq.user.userId;

  let userSafe: any = null;
  const user = await findUser(userId);
  
  if (user) {
    userSafe = sanitizeUser(user);
  } else {
    const org = await findOrg(userId);
    if (org) {
      const workspaces = await Workspace.find({ orgId: org._id });
      const orgIdStr = org._id.toString();

      userSafe = {
        id: orgIdStr,
        name: org.name,
        email: org.email,
        username: org.name.replace(/\s+/g, "").toLowerCase(),
        avatar: "",
        status: "online",
        organizations: [{
            orgId: orgIdStr,
            role: "admin",
            joinedAt: (org.createdAt || new Date()).toISOString(),
        }],
        workspaces: workspaces.map(w => ({
          workspaceId: w._id.toString(),
          name: w.name,
          joinedAt: w.createdAt.toISOString()
        }))
      };
    }
  }

  if (!userSafe) {
    res.status(401).json({
      success: false,
      error: { message: "Session expired or user not found" },
    });
    return;
  }

  sendSuccess(res, { user: userSafe });
});

// Exported Methods

export const addOrganizationToUser = async (userId: string, orgId: string, role: string): Promise<void> => {
  const user = await findUser(userId);
  if (user) {
    if ((user.organizations as any).some((o: any) => o.orgId.toString() === orgId)) return;
    await UserModel.findByIdAndUpdate(userId, {
      $push: { organizations: { orgId, role, joinedAt: new Date() } },
    });
    logger.info("Organization added to user", { userId, orgId, role });
    return;
  }

  const org = await findOrg(userId);
  if (org) {
    logger.info("Organization invite used by organization founder", { orgId: userId, targetOrgId: orgId });
    return;
  }

  throw new NotFoundError("User");
};

export const addWorkspaceToUser = async (userId: string, workspaceId: string, name: string): Promise<void> => {
  const user = await findUser(userId);
  if (user) {
    if (user.workspaces?.some(w => w.workspaceId.toString() === workspaceId)) return;
    await UserModel.findByIdAndUpdate(userId, {
      $addToSet: { workspaces: { workspaceId, name, joinedAt: new Date() } },
    });
    logger.info("Workspace added to user", { userId, workspaceId, name });
    return;
  }

  const org = await findOrg(userId);
  if (org) return;

  throw new NotFoundError("User or Organization");
};

export const removeWorkspaceFromUser = async (userId: string, workspaceId: string): Promise<void> => {
  await UserModel.findByIdAndUpdate(userId, {
    $pull: { workspaces: { workspaceId } },
  });
};

export const googleCallback = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  if (!user) throw new AuthenticationError("Google authentication failed");

  const tokens = generateTokenPair(user._id.toString(), user.organizations);

  const hashedRefresh = hashToken(tokens.refreshToken);
  await UserModel.findByIdAndUpdate(user._id, { refreshToken: hashedRefresh });

  logger.info("User logged in via Google", { userId: user._id });

  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);

  // Redirect to frontend (dashboard or join page)
  const isFounder = user.organizations?.some((org: any) => org.orgId.toString() === user._id.toString() && org.role === "admin");
  let redirectUrl = config.FRONTEND_URL;

  if (user.workspaces && user.workspaces.length > 0) {
    redirectUrl = `${config.FRONTEND_URL}/workspace/${user.workspaces[0].workspaceId}`;
  } else if (isFounder) {
    redirectUrl = `${config.FRONTEND_URL}/workspace/setup`;
  } else {
    redirectUrl = `${config.FRONTEND_URL}/workspace/join`;
  }

  res.redirect(redirectUrl);
});
