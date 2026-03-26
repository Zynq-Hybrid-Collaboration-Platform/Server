import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { ITenantRequest } from "../types/request.types";
import { AuthorizationError } from "../errors/AuthorizationError";
import { NotFoundError } from "../errors/NotFoundError";
import { Channel } from "../models/channel.model";

export const requireChannelAccess = async (
  req: ITenantRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { channelId } = req.params;
    const userRole = req.tenantContext?.role;

    if (!userRole) {
      return next(new AuthorizationError("No role found — tenant context missing"));
    }

    if (!channelId) {
      return next(new Error("channelAccess middleware requires a :channelId param"));
    }

    const channel = await Channel.findById(new Types.ObjectId(channelId));

    if (!channel) {
      return next(new NotFoundError("Channel not found"));
    }

    if (userRole === "admin") {
      return next();
    }

    if (!channel.allowedRoles || channel.allowedRoles.length === 0) {
      return next();
    }

    if (!channel.allowedRoles.includes(userRole)) {
      return next(
        new AuthorizationError("You do not have permission to access inside this channel")
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
