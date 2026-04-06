import { Request, Response } from "express";
import { UserModel } from "../models/auth.model";
import Workspace from "../models/workspace.model";
import { Organization } from "../models/organization.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { IAuthenticatedRequest } from "../types/request.types";
import { NotFoundError } from "../errors";

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
          joinedAt: w.createdAt.toISOString(),
        })),
        createdAt: (org.createdAt || new Date()).toISOString(),
      },
    });
    return;
  }

  throw new NotFoundError("User not found");
});
