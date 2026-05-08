import { Request, Response } from "express";
import { Types } from "mongoose";
import { Channel, ChannelType, IChannel } from "../models/channel.model";
import WorkspaceModel from "../models/workspace.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { AuthorizationError } from "../errors/AuthorizationError";
import { NotFoundError } from "../errors/NotFoundError";
import { NotificationType } from "../models/notification.model";
import { createAndSendNotification } from "./notification.controller";
import { UserModel as User } from "../models/auth.model";

// Workspace cleanup logic
export const deleteChannelsByWorkspace = async (workspaceId: string): Promise<any> => {
  return Channel.deleteMany({ workspaceId: new Types.ObjectId(workspaceId) });
};

// Create a new channel (Admin only)
export const createChannel = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { name, type, workspaceId, parentId, allowedRoles } = req.body;
  const user = (req as any).user;

  // Verify permissions: Only admin of the workspace's org can create channels
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace");

  const membership = user.organizations.find((o: any) => o.orgId === workspace.orgId.toString());
  if (!membership || membership.role !== "admin") {
    throw new AuthorizationError("Only organization admins can create channels");
  }
  
  const channel = await Channel.create({
    name,
    type,
    workspaceId: new Types.ObjectId(workspaceId),
    parentId: parentId ? new Types.ObjectId(parentId) : null,
    allowedRoles,
  });

  // Notify workspace members
  const creator = await User.findById(user.userId);
  const creatorName = creator?.name || "Someone";
  
  // For simplicity, notify all workspace members if it's a public channel (no allowedRoles)
  // or if the user is an admin. In a more complex app, we'd check visibility.
  for (const member of workspace.members) {
      if (member.userId.toString() === user.userId) continue;
      
      await createAndSendNotification(req, {
          recipientId: member.userId.toString(),
          senderId: user.userId,
          type: NotificationType.CHANNEL_CREATED,
          title: "New Channel Created",
          message: `A new channel #${channel.name} was created by ${creatorName}.`,
          metadata: { workspaceId, channelId: channel._id.toString() },
      });
  }

  sendSuccess(res, { channel }, 201);
});

export const getChannelsByWorkspace = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const user = (req as any).user;

  // Try to find the user's role in the organization that owns this workspace
  const workspace = await WorkspaceModel.findById(workspaceId);
  const userRole = user.organizations.find((o: any) => o.orgId === workspace?.orgId.toString())?.role || "member";
  
  const channels = await Channel.find({
    workspaceId: new Types.ObjectId(workspaceId),
  }).sort({ order: 1 });

  const filtered = channels.filter((channel) => {
    if (userRole === "admin") return true;
    
    // Explicit member access
    if (channel.members && channel.members.some((id: any) => id.toString() === user.userId)) {
      return true;
    }

    if (!channel.allowedRoles || channel.allowedRoles.length === 0) return true;
    return channel.allowedRoles.includes(userRole);
  });

  sendSuccess(res, { channels: filtered });
});

// Update channel details (Admin only)
export const updateChannel = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params;
  const updateData = req.body;
  const user = (req as any).user;

  const channel = await Channel.findById(channelId);
  if (!channel) throw new NotFoundError("Channel");

  const workspace = await WorkspaceModel.findById(channel.workspaceId);
  const membership = user.organizations.find((o: any) => o.orgId === workspace?.orgId.toString());
  if (!membership || membership.role !== "admin") {
    throw new AuthorizationError("Only organization admins can update channels");
  }

  const formattedData: any = { ...updateData };
  if (updateData.parentId !== undefined) {
    formattedData.parentId = updateData.parentId
      ? new Types.ObjectId(updateData.parentId)
      : null;
  }

  const updatedChannel = await Channel.findByIdAndUpdate(
    new Types.ObjectId(channelId),
    formattedData,
    { new: true }
  );

  sendSuccess(res, { channel: updatedChannel });
});

// Delete a channel (Admin only)
export const deleteChannel = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params;
  const user = (req as any).user;

  const channel = await Channel.findById(channelId);
  if (!channel) throw new NotFoundError("Channel");

  const workspace = await WorkspaceModel.findById(channel.workspaceId);
  const membership = user.organizations.find((o: any) => o.orgId === workspace?.orgId.toString());
  if (!membership || membership.role !== "admin") {
    throw new AuthorizationError("Only organization admins can delete channels");
  }

  await Channel.findByIdAndDelete(new Types.ObjectId(channelId));

  // Notify all channel members about deletion
  if (channel.members) {
      for (const memberId of channel.members) {
          if (memberId.toString() === user.userId) continue;
          await createAndSendNotification(req, {
              recipientId: memberId.toString(),
              senderId: user.userId,
              type: NotificationType.CHANNEL_DELETED,
              title: "Channel Deleted",
              message: `The channel #${channel.name} has been deleted.`,
              metadata: { workspaceId: channel.workspaceId.toString() },
          });
      }
  }

  sendSuccess(res, { message: "Channel deleted successfully" });
});

// Add member to channel
export const addChannelMember = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params;
  const { userId } = req.body;

  const channel = await Channel.findByIdAndUpdate(
    new Types.ObjectId(channelId),
    { $addToSet: { members: new Types.ObjectId(userId) } },
    { new: true }
  );

  if (!channel) throw new NotFoundError("Channel");

  // Send notifications
  const requesterId = (req as any).user.userId;
  const [requester, addedUser] = await Promise.all([
      User.findById(requesterId),
      User.findById(userId)
  ]);
  const addedUserName = addedUser?.name || "A user";

  // Recipient 1: The User being added
  await createAndSendNotification(req, {
      recipientId: userId,
      senderId: requesterId,
      type: NotificationType.CHANNEL_MEMBER_ADDED,
      title: "Added to Channel",
      message: `You have been added to the channel #${channel.name}.`,
      metadata: { channelId: channel._id.toString(), workspaceId: channel.workspaceId.toString() },
  });

  // Recipient 2: Existing Channel Members
  if (channel.members) {
      for (const memberId of channel.members) {
          if (memberId.toString() === requesterId || memberId.toString() === userId.toString()) continue;
          await createAndSendNotification(req, {
              recipientId: memberId.toString(),
              senderId: requesterId,
              type: NotificationType.CHANNEL_MEMBER_ADDED,
              title: "New Channel Member",
              message: `${addedUserName} has joined #${channel.name}.`,
              metadata: { channelId: channel._id.toString() },
          });
      }
  }

  sendSuccess(res, { channel });
});

// Remove member from channel
export const removeChannelMember = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { channelId, userId } = req.params;

  const channel = await Channel.findByIdAndUpdate(
    new Types.ObjectId(channelId),
    { $pull: { members: new Types.ObjectId(userId) } },
    { new: true }
  );

  if (!channel) throw new NotFoundError("Channel");

  // Notify the removed user
  const requesterId = (req as any).user.userId;
  await createAndSendNotification(req, {
      recipientId: userId,
      senderId: requesterId,
      type: NotificationType.CHANNEL_MEMBER_REMOVED,
      title: "Removed from Channel",
      message: `You have been removed from #${channel.name}.`,
      metadata: { channelId: channel._id.toString() },
  });

  sendSuccess(res, { channel });
});
