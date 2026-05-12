import { Request, Response } from "express";
import { UserModel } from "../models/auth.model";
import Workspace from "../models/workspace.model";
import { Organization } from "../models/organization.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { IAuthenticatedRequest } from "../types/request.types";
import { NotFoundError, ValidationError } from "../errors";
import bcrypt from "bcrypt";

// ─────────────────────────────────────────────────────
// GET /api/v1/users/profile
// Returns the authenticated user's full profile
// ─────────────────────────────────────────────────────

export const getProfile = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const authReq = req as IAuthenticatedRequest;
  const userId = authReq.user.userId;

  // Try regular user first
  const user = await UserModel.findById(userId).lean();

  if (user) {
    sendSuccess(res, {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        status: user.status,
        bio: user.bio || "",
        timezone: user.timezone || "UTC",
        notificationPreferences: user.notificationPreferences || { email: true, inApp: true },
        organizations: (user.organizations || []).map((o: any) => ({
          orgId: o.orgId.toString(),
          role: o.role,
          joinedAt: o.joinedAt instanceof Date ? o.joinedAt.toISOString() : o.joinedAt,
        })),
        workspaces: (user.workspaces || []).map((w: any) => ({
          workspaceId: w.workspaceId.toString(),
          name: w.name,
          joinedAt: w.joinedAt instanceof Date ? w.joinedAt.toISOString() : w.joinedAt,
        })),
        createdAt: user.createdAt?.toISOString?.() ?? null,
      },
    });
    return;
  }

  // Fallback: check if the ID belongs to an organization (founder login)
  const org = await Organization.findById(userId).lean();
  if (org) {
    const workspaces = await Workspace.find({ orgId: org._id });
    const orgIdStr = org._id.toString();

    sendSuccess(res, {
      user: {
        id: orgIdStr,
        name: org.name,
        email: org.email,
        username: org.name.replace(/\s+/g, "").toLowerCase(),
        avatar: org.avatar || "",
        bio: (org as any).bio || "",
        timezone: (org as any).timezone || "UTC",
        status: "online",
        organizations: [{
          orgId: orgIdStr,
          role: "admin",
          joinedAt: (org.createdAt || new Date()).toISOString(),
        }],
        workspaces: workspaces.map(w => ({
          workspaceId: w._id.toString(),
          name: w.name,
          joinedAt: w.createdAt.toISOString(),
        })),
        createdAt: (org.createdAt || new Date()).toISOString(),
      },
    });
    return;
  }

  throw new NotFoundError("User not found");
});

// ─────────────────────────────────────────────────────
// PATCH /api/v1/users/profile
// Update own profile
// ─────────────────────────────────────────────────────

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as IAuthenticatedRequest;
  const userId = authReq.user.userId;
  const { name, username, bio, timezone, avatar } = req.body;

  const user = await UserModel.findById(userId);

  if (!user) {
    // Fallback: org founder login — update the Organization record
    const org = await Organization.findById(userId);
    if (!org) throw new NotFoundError("User not found");

    if (name) org.name = name;
    if (bio !== undefined) (org as any).bio = bio;
    if (timezone) (org as any).timezone = timezone;
    if (avatar !== undefined) (org as any).avatar = avatar;
    await org.save();

    const workspaces = await Workspace.find({ orgId: org._id });
    sendSuccess(res, {
      user: {
        id: org._id.toString(),
        name: org.name,
        email: org.email,
        username: org.name.replace(/\s+/g, "").toLowerCase(),
        avatar: org.avatar || "",
        bio: (org as any).bio || "",
        timezone: (org as any).timezone || "UTC",
        status: "online",
        notificationPreferences: { email: true, inApp: true },
        organizations: [{ orgId: org._id.toString(), role: "owner", joinedAt: (org.createdAt || new Date()).toISOString() }],
        workspaces: workspaces.map(w => ({ workspaceId: w._id.toString(), name: w.name, joinedAt: w.createdAt.toISOString() })),
        createdAt: (org.createdAt || new Date()).toISOString(),
      }
    });
    return;
  }

  if (username && username !== user.username) {
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) throw new ValidationError("Username already taken");
  }

  if (name) user.name = name;
  if (username) user.username = username;
  if (bio !== undefined) user.bio = bio;
  if (timezone) user.timezone = timezone;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();

  // Socket broadcast (Task 9)
  const io = req.app.get("io");
  if (io) {
    const workspaceIds = user.workspaces?.map(w => w.workspaceId.toString()) || [];
    const profilePayload = {
      userId,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      username: user.username,
    };

    for (const wsId of workspaceIds) {
      io.to(`workspace_${wsId}`).emit("user:profile-updated", profilePayload);
    }
  }

  sendSuccess(res, {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio || "",
      timezone: user.timezone || "UTC",
      status: user.status,
      notificationPreferences: user.notificationPreferences || { email: true, inApp: true },
      organizations: (user.organizations || []).map((o: any) => ({
        orgId: o.orgId.toString(),
        role: o.role,
        joinedAt: o.joinedAt instanceof Date ? o.joinedAt.toISOString() : o.joinedAt
      })),
      workspaces: (user.workspaces || []).map((w: any) => ({
        workspaceId: w.workspaceId.toString(),
        name: w.name,
        joinedAt: w.joinedAt instanceof Date ? w.joinedAt.toISOString() : w.joinedAt
      })),
      createdAt: user.createdAt?.toISOString?.() ?? null,
    }
  });
});

// ─────────────────────────────────────────────────────
// PATCH /api/v1/users/password
// Change password
// ─────────────────────────────────────────────────────

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as IAuthenticatedRequest;
  const userId = authReq.user.userId;
  const { currentPassword, newPassword } = req.body;

  const user = await UserModel.findById(userId).select("+password");

  if (!user) {
    // Fallback: Org Founder login — change Organization password
    const org = await Organization.findById(userId).select("+password");
    if (!org) throw new NotFoundError("User not found");

    const isMatch = await bcrypt.compare(currentPassword, org.password);
    if (!isMatch) throw new ValidationError("Incorrect current password");

    org.password = await bcrypt.hash(newPassword, 12);
    await org.save();

    sendSuccess(res, { message: "Organization password updated successfully" });
    return;
  }

  if (user.googleId && !user.password) {
    throw new ValidationError("Password change not available for Google accounts");
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password!);
  if (!isMatch) throw new ValidationError("Incorrect current password");

  user.password = await bcrypt.hash(newPassword, 12);
  user.refreshToken = ""; // Invalidate refresh tokens

  await user.save();

  sendSuccess(res, { message: "Password updated successfully" });
});

// ─────────────────────────────────────────────────────
// PATCH /api/v1/users/notifications
// Update notification preferences
// ─────────────────────────────────────────────────────

export const updateNotifications = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as IAuthenticatedRequest;
  const userId = authReq.user.userId;
  const { email, inApp } = req.body;

  const user = await UserModel.findById(userId);

  if (!user) {
    // Org founder — no notification preferences, return success
    sendSuccess(res, { notificationPreferences: { email: email ?? true, inApp: inApp ?? true } });
    return;
  }

  // Guard for older accounts that may not have this field
  if (!user.notificationPreferences) {
    user.notificationPreferences = { email: true, inApp: true };
  }

  if (email !== undefined) user.notificationPreferences.email = email;
  if (inApp !== undefined) user.notificationPreferences.inApp = inApp;

  await user.save();

  sendSuccess(res, { notificationPreferences: user.notificationPreferences });
});

// ─────────────────────────────────────────────────────
// GET /api/v1/users/:userId
// Get public profile of any user
// ─────────────────────────────────────────────────────

export const getPublicProfile = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const user = await UserModel.findById(userId).select("name username avatar bio status");
  if (!user) throw new NotFoundError("User not found");

  sendSuccess(res, { user });
});

// ─────────────────────────────────────────────────────
// DELETE /api/v1/users/account
// Delete own account
// ─────────────────────────────────────────────────────

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const authReq = req as IAuthenticatedRequest;
  const userId = authReq.user.userId;

  const user = await UserModel.findById(userId);
  if (!user) throw new ValidationError("Organization accounts cannot be deleted through this endpoint");

  // Check if owner of any workspace
  const ownedWorkspaces = await Workspace.find({
    members: { $elemMatch: { userId, role: "owner" } }
  });

  if (ownedWorkspaces.length > 0) {
    throw new ValidationError("Transfer ownership before deleting account");
  }

  const workspaceIds = user.workspaces?.map(w => w.workspaceId.toString()) || [];

  // Delete user document
  await UserModel.findByIdAndDelete(userId);

  // Remove from all workspaces
  await Workspace.updateMany(
    { "members.userId": userId },
    { $pull: { members: { userId } } }
  );

  // Remove from all organizations
  await Organization.updateMany(
    { members: userId },
    { $pull: { members: userId } }
  );

  // Socket broadcast (Task 8)
  const io = req.app.get("io");
  if (io) {
    for (const wsId of workspaceIds) {
      io.to(`workspace_${wsId}`).emit("member:removed", { userId, workspaceId: wsId });
    }
  }

  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  sendSuccess(res, { message: "Account deleted successfully" });
});
