import { Request, Response } from "express";
import crypto from "crypto";
import { Types } from "mongoose";
import { InviteCode } from "../models/invite.model";
import { Organization } from "../models/organization.model";
import Workspace from "../models/workspace.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { IAuthenticatedRequest } from "../types/request.types";
import * as authController from "./auth.controller";
import {
  IInviteSafe,
} from "../types/invite.types";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../errors";

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function sanitizeInvite(invite: any): IInviteSafe {
  return {
    id: invite._id.toString(),
    organizationId: invite.organizationId.toString(),
    workspaceId: invite.workspaceId.toString(),
    code: invite.code,
    expiresAt: invite.expiresAt.toISOString(),
    createdBy: invite.createdBy.toString(),
    maxUses: invite.maxUses,
    uses: invite.uses,
    isActive: invite.isActive,
    createdAt: invite.createdAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────

export const createInviteCode = catchAsync(async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const { expiresIn, maxUses } = req.body;
  const userId = req.user.userId;

  const workspace = await Workspace.findById(new Types.ObjectId(workspaceId));
  if (!workspace) throw new NotFoundError("Workspace not found");

  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  
  // Parse expiresIn (e.g., "24h", "7d")
  let durationMs = 24 * 60 * 60 * 1000; // Default 24h
  if (expiresIn) {
    const value = parseInt(expiresIn);
    if (expiresIn.endsWith("h")) durationMs = value * 60 * 60 * 1000;
    else if (expiresIn.endsWith("d")) durationMs = value * 24 * 60 * 60 * 1000;
  }
  const expiresAt = new Date(Date.now() + durationMs);

  const invite = await InviteCode.create({
    organizationId: workspace.orgId,
    workspaceId: workspace._id,
    code,
    expiresAt,
    createdBy: new Types.ObjectId(userId),
    maxUses: maxUses || 0,
  });

  sendSuccess(res, { invite: sanitizeInvite(invite) }, 201);
});

export const validateInviteCode = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params;
  
  const invite = await InviteCode.findOne({ code, isActive: true });
  if (!invite) throw new NotFoundError("Invalid or expired invite code");
  if (new Date() > invite.expiresAt) throw new ValidationError("Invite code has expired");
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) throw new ValidationError("Invite code has reached maximum uses");

  const [org, workspace] = await Promise.all([
    Organization.findById(invite.organizationId),
    Workspace.findById(invite.workspaceId)
  ]);

  if (!org) throw new NotFoundError("Organization not found");
  if (!workspace) throw new NotFoundError("Workspace not found");

  sendSuccess(res, {
    valid: true,
    organizationId: org._id.toString(),
    organizationName: org.name,
    workspaceId: workspace._id.toString(),
    workspaceName: workspace.name,
    roles: org.roles,
  });
});

export const getOrgInvites = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const invites = await InviteCode.find({ organizationId: new Types.ObjectId(orgId) }).sort({ createdAt: -1 });
  sendSuccess(res, { invites: invites.map(sanitizeInvite) });
});

export const getWorkspaceInvites = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(new Types.ObjectId(workspaceId));
  if (!workspace) throw new NotFoundError("Workspace not found");

  const invites = await InviteCode.find({
    workspaceId: new Types.ObjectId(workspaceId),
    isActive: true,
  })
    .populate("createdBy", "name username email avatar")
    .sort({ createdAt: -1 });

  sendSuccess(res, { invites: invites.map(sanitizeInvite) });
});

export const refreshWorkspaceInvite = catchAsync(async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const { expiresInHours, maxUses } = req.body;
  const userId = req.user.userId;

  const workspace = await Workspace.findById(new Types.ObjectId(workspaceId));
  if (!workspace) throw new NotFoundError("Workspace not found");

  // Deactivate existing active invites for this workspace
  await InviteCode.updateMany(
    { workspaceId: new Types.ObjectId(workspaceId), isActive: true },
    { isActive: false }
  );

  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + (expiresInHours || 24) * 60 * 60 * 1000);

  const invite = await InviteCode.create({
    organizationId: workspace.orgId,
    workspaceId: workspace._id,
    code,
    expiresAt,
    createdBy: new Types.ObjectId(userId),
    maxUses: maxUses || 0,
  });

  sendSuccess(res, { invite: sanitizeInvite(invite), message: "Invite code refreshed successfully" }, 201);
});

export const deactivateInvite = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { inviteId } = req.params;
  const result = await InviteCode.findByIdAndUpdate(new Types.ObjectId(inviteId), { isActive: false }, { new: true });
  if (!result) throw new NotFoundError("Invite code not found");
  sendSuccess(res, { message: "Invite code deactivated successfully" });
});

export const deleteInvite = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { inviteId } = req.params;
  const result = await InviteCode.findByIdAndDelete(new Types.ObjectId(inviteId));
  if (!result) throw new NotFoundError("Invite code not found");
  sendSuccess(res, { message: "Invite code deleted successfully" });
});

export const joinWorkspace = catchAsync(async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
  const { inviteCode } = req.body;
  const userId = req.user.userId;

  const invite = await InviteCode.findOne({ code: inviteCode, isActive: true });
  if (!invite) throw new NotFoundError("Invalid or expired invite code");
  if (new Date() > invite.expiresAt) throw new ValidationError("Invite code has expired");
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) throw new ValidationError("Invite code has reached maximum uses");

  const [org, workspace] = await Promise.all([
    Organization.findById(invite.organizationId),
    Workspace.findById(invite.workspaceId)
  ]);

  if (!org) throw new NotFoundError("Organization not found");
  if (!workspace) throw new NotFoundError("Workspace not found");

  const role = "member";

  if (!org.roles.includes(role)) {
    await Organization.findByIdAndUpdate(org._id, { $addToSet: { roles: role } });
  }

  await authController.addOrganizationToUser(userId, org._id.toString(), role);
  await authController.addWorkspaceToUser(userId, workspace._id.toString(), workspace.name);

  await Workspace.findByIdAndUpdate(
    workspace._id,
    { $addToSet: { members: { userId: new Types.ObjectId(userId), role: "member" } } },
    { new: true }
  );

  // Consume invite
  await InviteCode.findByIdAndUpdate(invite._id, { $inc: { uses: 1 } });
  if (invite.maxUses > 0 && invite.uses + 1 >= invite.maxUses) {
    await InviteCode.findByIdAndUpdate(invite._id, { isActive: false });
  }

  sendSuccess(res, {
    message: "Successfully joined workspace",
    organizationId: org._id.toString(),
    organizationName: org.name,
    workspaceId: workspace._id.toString(),
    workspaceName: workspace.name,
  });
});
