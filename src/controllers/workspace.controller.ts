import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import Workspace from "../models/workspace.model";
import { UserModel as User } from "../models/auth.model";
import { NotFoundError, ForbiddenError, ValidationError } from "../errors";
import * as authController from "./auth.controller";
import * as channelController from "./channel.controller";
import { Channel, ChannelType } from "../models/channel.model";
import { IAuthenticatedRequest } from "../types/request.types";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { NotificationType } from "../models/notification.model";
import { createAndSendNotification } from "./notification.controller";

export const createWorkspaceController = catchAsync(async (req: IAuthenticatedRequest, res: Response) => {
  const { orgId, name } = req.body;
  const userId = req.user.userId;

  const effectiveOrgId = orgId || userId;

  if (!effectiveOrgId) {
    throw new ValidationError("Organization ID is required");
  }

  const workspace = await Workspace.create({
    orgId: new Types.ObjectId(effectiveOrgId as string),
    name,
    members: [{ 
      userId: new Types.ObjectId(userId),
      role: "owner"
    }],
  });

  await Channel.create({
    name: "general",
    type: ChannelType.TEXT,
    workspaceId: workspace._id,
    parentId: null,
    allowedRoles: [],
    members: [new Types.ObjectId(userId)]
  });

  await authController.addWorkspaceToUser(
    userId,
    workspace._id.toString(),
    workspace.name
  );

  sendSuccess(res, { workspace }, 201);
});

export const getWorkspaceByIdController = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findById(new Types.ObjectId(workspaceId));
  if (!workspace) throw new NotFoundError("Workspace not found");
  sendSuccess(res, { workspace });
});

export const getWorkspacesByOrgController = catchAsync(async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const workspaces = await Workspace.find({ orgId: new Types.ObjectId(orgId) });
  sendSuccess(res, { workspaces });
});

export const updateWorkspaceController = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { name, description, avatarUrl } = req.body;
  
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const workspace = await Workspace.findByIdAndUpdate(
    new Types.ObjectId(workspaceId),
    { $set: updates },
    { new: true }
  );

  if (!workspace) throw new NotFoundError("Workspace not found");
  sendSuccess(res, { workspace });
});

export const deleteWorkspaceController = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findByIdAndDelete(new Types.ObjectId(workspaceId));
  if (!workspace) throw new NotFoundError("Workspace not found");

  await channelController.deleteChannelsByWorkspace(workspaceId);

  // Notify all members about workspace deletion
  const requesterId = (req as any).user.userId;
  for (const member of workspace.members) {
      if (member.userId.toString() === requesterId) continue;
      await createAndSendNotification(req, {
          recipientId: member.userId.toString(),
          senderId: requesterId,
          type: NotificationType.WORKSPACE_DELETED,
          title: "Workspace Deleted",
          message: `The workspace ${workspace.name} has been deleted.`,
          metadata: { workspaceName: workspace.name },
      });
  }

  sendSuccess(res, { 
    message: "Workspace deleted successfully",
    workspace 
  });
});

export const addMemberController = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { userId } = req.body;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace not found");

  // Check if user is already a member to prevent duplicates
  const isAlreadyMember = workspace.members.some(
    (m) => m.userId.toString() === userId.toString()
  );

  if (isAlreadyMember) {
    throw new ValidationError("User is already a member of this workspace");
  }

  workspace.members.push({
    userId: new Types.ObjectId(userId),
    role: "member",
    joinedAt: new Date()
  });

  await workspace.save();

  // Send notifications
  const requester = (req as any).user;
  if (requester) {
    const [adminUser, addedUser] = await Promise.all([
      User.findById(requester.userId),
      User.findById(userId)
    ]);
    const adminName = adminUser?.name || "An admin";
    const addedUserName = addedUser?.name || "A user";

    // Recipient 1: The User being added
    await createAndSendNotification(req, {
      recipientId: userId,
      senderId: requester.userId,
      type: NotificationType.WORKSPACE_MEMBER_ADDED,
      title: "Added to Workspace",
      message: `${adminName} added you to the workspace: ${workspace.name}`,
      metadata: { workspaceId: workspace._id.toString() },
    });

    // Recipient 2: Workspace Owner & Admins
    const adminRecipients = workspace.members.filter(m => (m.role === "owner" || m.role === "admin") && m.userId.toString() !== requester.userId);
    for (const recipient of adminRecipients) {
         await createAndSendNotification(req, {
            recipientId: recipient.userId.toString(),
            senderId: requester.userId,
            type: NotificationType.WORKSPACE_MEMBER_ADDED,
            title: "Member Added",
            message: `${adminName} added ${addedUserName} to the workspace.`,
            metadata: { workspaceId: workspace._id.toString() },
        });
    }
  }

  sendSuccess(res, { 
    message: "Member added to workspace",
    workspace 
  });
});

export const removeMemberController = catchAsync(async (req: IAuthenticatedRequest, res: Response) => {
  const { workspaceId, userId } = req.params;
  const requesterId = req.user.userId;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace not found");

  const memberToKick = workspace.members.find(m => m.userId.toString() === userId);
  if (!memberToKick) throw new NotFoundError("User is not a member of this workspace");

  // Protection: Admin cannot kick Owner
  if (memberToKick.role === "owner") {
    throw new ForbiddenError("Workspace owners cannot be removed");
  }

  // Remove from Workspace
  workspace.members = workspace.members.filter(m => m.userId.toString() !== userId) as any;
  await workspace.save();

  // Cascade: Remove from all channels in this workspace
  await Channel.updateMany(
    { workspaceId: new Types.ObjectId(workspaceId) },
    { $pull: { members: new Types.ObjectId(userId) } }
  );

  // Notify the removed member
  await createAndSendNotification(req, {
      recipientId: userId,
      senderId: requesterId,
      type: NotificationType.WORKSPACE_MEMBER_REMOVED,
      title: "Removed from Workspace",
      message: `You have been removed from ${workspace.name}.`,
      metadata: { workspaceId: workspace._id.toString() },
  });

  sendSuccess(res, { message: "Member removed from workspace and all channels" });
});

export const updateMemberRoleController = catchAsync(async (req: IAuthenticatedRequest, res: Response) => {
  const { workspaceId, userId } = req.params;
  const { role } = req.body;
  
  if (userId === req.user.userId) {
    throw new ValidationError("You cannot change your own role");
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace not found");

  // Only Owner can change roles
  const requester = workspace.members.find(m => m.userId.toString() === req.user.userId);
  if (!requester || requester.role !== "owner") {
    throw new ForbiddenError("Only workspace owners can change member roles");
  }

  const hasMember = workspace.members.some(m => m.userId.toString() === userId);
  if (!hasMember) throw new NotFoundError("Member not found in workspace");

  // Update all entries for this user (handles legacy duplicates)
  workspace.members.forEach(m => {
    if (m.userId.toString() === userId) {
      m.role = role;
    }
  });

  await workspace.save();

  // Notify the user about their role update
  await createAndSendNotification(req, {
      recipientId: userId,
      senderId: req.user.userId,
      type: NotificationType.WORKSPACE_ROLE_UPDATED,
      title: "Role Updated",
      message: `Your role in ${workspace.name} has been updated to ${role}.`,
      metadata: { workspaceId: workspace._id.toString(), newRole: role },
  });

  sendSuccess(res, { message: `Member role updated to ${role}` });
});

export const updatePermissionsController = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const permissions = req.body;

  const workspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    { $set: { permissions } },
    { new: true }
  );

  if (!workspace) throw new NotFoundError("Workspace not found");
  sendSuccess(res, { workspace });
});

export const getWorkspaceMembersController = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { page = 1, limit = 20, search = "" } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  // We need to find the workspace first to get the member list
  const workspace = await Workspace.findById(workspaceId).select("members");
  if (!workspace) throw new NotFoundError("Workspace not found");

  const memberIds = workspace.members.map(m => m.userId);

  // Build query for users
  const userQuery: any = { _id: { $in: memberIds } };
  if (search) {
    userQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(userQuery)
      .select("name username email avatar")
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(userQuery)
  ]);

  // Map workspace roles back to user objects
  const membersWithRoles = users.map(user => {
    const workspaceMember = workspace.members.find(m => m.userId.toString() === user._id.toString());
    return {
      ...user,
      id: user._id,
      role: workspaceMember?.role || "member",
      joinedAt: workspaceMember?.joinedAt
    };
  });

  sendSuccess(res, {
    members: membersWithRoles,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  });
});
