import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import Workspace from "../models/workspace.model";
import { IAuthenticatedRequest } from "../types/request.types";
import { ForbiddenError, NotFoundError } from "../errors";
import { catchAsync } from "./async-handler";

/**
 * Middleware to authorize access to a workspace based on roles.
 * @param allowedRoles Array of roles that are allowed to access the route.
 * If empty, any member of the workspace is allowed.
 */
export const authorizeWorkspace = (allowedRoles: string[] = []) => {
  return catchAsync(async (req: IAuthenticatedRequest, res: Response, next: NextFunction) => {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    if (!workspaceId) {
      throw new NotFoundError("Workspace ID is required in request parameters");
    }

    const workspace = await Workspace.findById(new Types.ObjectId(workspaceId));
    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    const member = workspace.members.find(
      (m) => m.userId.toString() === userId.toString()
    );

    if (!member) {
      throw new ForbiddenError("You are not a member of this workspace");
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(member.role)) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }

    // Attach workspace and member role to request for use in controllers
    (req as any).workspace = workspace;
    (req as any).memberRole = member.role;

    next();
  });
};
