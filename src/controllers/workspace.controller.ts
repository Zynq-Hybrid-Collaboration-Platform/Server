import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import Workspace from "../models/workspace.model";
import { UserModel } from "../models/auth.model";
import { NotFoundError } from "../errors";
import * as authController from "./auth.controller";
import * as channelController from "./channel.controller";
import { Channel, ChannelType } from "../models/channel.model";

export const createWorkspaceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, name } = req.body;
    const authReq = req as any;

    const effectiveOrgId = orgId || authReq.user?.userId;

    if (!effectiveOrgId) {
      return res.status(400).json({
        success: false,
        error: { message: "Organization ID is required" }
      });
    }

    const workspace = await Workspace.create({
      orgId: new Types.ObjectId(effectiveOrgId as string),
      name,
      members: [{ userId: new Types.ObjectId(authReq.user.userId) }],
    });

    await Channel.create({
      name: "general",
      type: ChannelType.TEXT,
      workspaceId: workspace._id,
      parentId: null,
      allowedRoles: [],
    });

    await authController.addWorkspaceToUser(
      authReq.user.userId,
      workspace._id.toString(),
      workspace.name
    );

    res.status(201).json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findById(new Types.ObjectId(workspaceId));
    if (!workspace) throw new NotFoundError("Workspace not found");
    res.status(200).json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
};

export const getWorkspacesByOrgController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const workspaces = await Workspace.find({ orgId: new Types.ObjectId(orgId) });
    res.status(200).json({ success: true, data: workspaces });
  } catch (error) {
    next(error);
  }
};

export const updateWorkspaceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspaceId } = req.params;
    const { name } = req.body;
    const workspace = await Workspace.findByIdAndUpdate(
      new Types.ObjectId(workspaceId),
      { name },
      { new: true }
    );
    if (!workspace) throw new NotFoundError("Workspace not found");
    res.status(200).json({ success: true, data: workspace });
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspaceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findByIdAndDelete(new Types.ObjectId(workspaceId));
    if (!workspace) throw new NotFoundError("Workspace not found");

    await channelController.deleteChannelsByWorkspace(workspaceId);

    res.status(200).json({
      success: true,
      message: "Workspace deleted successfully",
      data: workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const addMemberController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspaceId } = req.params;
    const { userId } = req.body;
    const workspace = await Workspace.findByIdAndUpdate(
      new Types.ObjectId(workspaceId),
      { $addToSet: { members: { userId: new Types.ObjectId(userId) } } },
      { new: true }
    );
    if (!workspace) throw new NotFoundError("Workspace not found");
    res.status(200).json({
      success: true,
      message: "Member added to workspace",
      data: workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const removeMemberController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, userId } = req.params;
    const workspace = await Workspace.findByIdAndUpdate(
      new Types.ObjectId(workspaceId),
      { $pull: { members: { userId: new Types.ObjectId(userId) } } },
      { new: true }
    );
    if (!workspace) throw new NotFoundError("Workspace not found");
    res.status(200).json({
      success: true,
      message: "Member removed from workspace",
      data: workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceMembersController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findById(workspaceId).populate("members.userId").lean();
    if (!workspace) throw new NotFoundError("Workspace not found");

    const orgIdStr = workspace.orgId.toString();

    const formattedMembers = (workspace.members || []).map((m: any) => {
      const user = m.userId;
      if (!user) return null;

      // Find user's role in the organization that owns this workspace
      const orgMembership = (user.organizations || []).find(
        (org: any) => org.orgId.toString() === orgIdStr
      );

      return {
        id: user._id?.toString() || user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar || "",
        role: orgMembership?.role || "member",
        joinedAt: m.joinedAt,
      };
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      data: {
        members: formattedMembers,
      },
    });
  } catch (error) {
    next(error);
  }
};
