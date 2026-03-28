import { Request, Response } from "express";
import { Types } from "mongoose";
import { Channel, ChannelType, IChannel } from "../models/channel.model";
import WorkspaceModel from "../models/workspace.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { AuthorizationError } from "../errors/AuthorizationError";
import { NotFoundError } from "../errors/NotFoundError";

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
  sendSuccess(res, { message: "Channel deleted successfully" });
});
