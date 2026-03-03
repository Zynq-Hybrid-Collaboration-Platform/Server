import { Application } from "express";
import { authRoutes } from "./domains/auth";
import { organizationRoutes } from "./domains/organization";
import { channelRoutes } from "./domains/channel";

const API_V1 = "/api/v1";

/**
 * Central route registry.
 * Every domain's routes are mounted here under the versioned API prefix.
 *
 * Active:
 *   - Auth domain (public + protected routes)
 *
 * Upcoming (uncomment when domain routes are wired):
 *   - Messaging, Tasks, Organizations, etc.
 */
export function registerRoutes(app: Application): void {
  // Auth domain — public + protected routes managed internally by auth.routes.ts
  app.use(`${API_V1}/auth`, authRoutes);
  app.use(`${API_V1}/organizations`, organizationRoutes);
  app.use(`${API_V1}/channels`, channelRoutes);

  // ------------------------------------------------------------------
  // Future domain routes (uncommented as each domain is implemented):
  //
  //
  // app.use(`${API_V1}/workspaces`, authenticate, extractTenant, workspaceRoutes);
  // app.use(`${API_V1}/servers`, authenticate, extractTenant, serverRoutes);
  // app.use(`${API_V1}/channels`, authenticate, extractTenant, channelRoutes);
  // app.use(`${API_V1}/orgs/:orgId/messages`, authenticate, extractTenant, messagingRoutes);
  // app.use(`${API_V1}/orgs/:orgId/tasks`, authenticate, extractTenant, taskRoutes);
  // app.use(`${API_V1}/notifications`, authenticate, notificationRoutes);
  // app.use(`${API_V1}/audit`, authenticate, extractTenant, auditRoutes);
  // ------------------------------------------------------------------
}
