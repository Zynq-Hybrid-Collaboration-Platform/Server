import { Request, Response } from "express";
import { Types } from "mongoose";
import { Channel, ChannelType, IChannel } from "../models/channel.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";

// ─────────────────────────────────────────────────────
// DB Logic (Formerly Service)
// ─────────────────────────────────────────────────────

export const deleteChannelsByWorkspace = async (workspaceId: string): Promise<any> => {
  return Channel.deleteMany({ workspaceId: new Types.ObjectId(workspaceId) });
};

// ─────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────

export const createChannel = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { name, type, workspaceId, parentId, allowedRoles } = req.body;
  
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
  const userRole = (req as any).tenantContext?.role || "member";
  
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

export const updateChannel = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params;
  const updateData = req.body;

  const formattedData: any = { ...updateData };
  if (updateData.parentId !== undefined) {
    formattedData.parentId = updateData.parentId
      ? new Types.ObjectId(updateData.parentId)
      : null;
  }

  const channel = await Channel.findByIdAndUpdate(
    new Types.ObjectId(channelId),
    formattedData,
    { new: true }
  );

  sendSuccess(res, { channel });
});

export const deleteChannel = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params;
  await Channel.findByIdAndDelete(new Types.ObjectId(channelId));
  sendSuccess(res, { message: "Channel deleted successfully" });
});
