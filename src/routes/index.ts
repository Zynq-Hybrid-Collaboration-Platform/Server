import { Application } from "express";
import { authRoutes } from "./auth.routes";
import { organizationRoutes } from "./organization.routes";
import { channelRoutes } from "./channel.routes";
import { inviteRoutes } from "./invite.routes";
import { workspaceRoutes } from "./workspace.routes";

const API_V1 = "/api/v1";

export function registerRoutes(app: Application): void {
  app.use(`${API_V1}/auth`, authRoutes);
  app.use(`${API_V1}/organizations`, organizationRoutes);
  app.use(`${API_V1}/channels`, channelRoutes);
  app.use(`${API_V1}/invites`, inviteRoutes);
  app.use(`${API_V1}/workspaces`, workspaceRoutes);
}
