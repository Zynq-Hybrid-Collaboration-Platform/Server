import { Router } from "express";
import * as workspaceController from "../controllers/workspace.controller";
import * as inviteController from "../controllers/invite.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeWorkspace } from "../middleware/workspace.middleware";
import { validate } from "../middleware/validate.middleware";
import { 
  updateWorkspaceSchema, 
  updateMemberRoleSchema, 
  updatePermissionsSchema,
  createInviteSchema 
} from "../validators/workspace.validator";

const router = Router();

// Basic CRUD
router.post("/", authenticate as never, workspaceController.createWorkspaceController);
router.get("/:workspaceId", authenticate as never, workspaceController.getWorkspaceByIdController);
router.get("/org/:orgId", authenticate as never, workspaceController.getWorkspacesByOrgController);

// General Settings (PATCH) - Admin/Owner only
router.patch(
  "/:workspaceId", 
  authenticate as never, 
  authorizeWorkspace(["admin", "owner"]),
  validate(updateWorkspaceSchema),
  workspaceController.updateWorkspaceController
);

router.delete(
  "/:workspaceId", 
  authenticate as never, 
  authorizeWorkspace(["owner"]), // Only owner can delete workspace
  workspaceController.deleteWorkspaceController
);

// Member Management
router.get(
  "/:workspaceId/members", 
  authenticate as never, 
  authorizeWorkspace([]), // Any member can view list
  workspaceController.getWorkspaceMembersController
);

router.patch(
  "/:workspaceId/members/:userId/role",
  authenticate as never,
  authorizeWorkspace(["owner"]), // Only owner can change roles
  validate(updateMemberRoleSchema),
  workspaceController.updateMemberRoleController
);

router.delete(
  "/:workspaceId/members/:userId",
  authenticate as never,
  authorizeWorkspace(["admin", "owner"]),
  workspaceController.removeMemberController
);

// Roles & Permissions API
router.patch(
  "/:workspaceId/permissions",
  authenticate as never,
  authorizeWorkspace(["admin", "owner"]),
  validate(updatePermissionsSchema),
  workspaceController.updatePermissionsController
);

// Invite Link API (Nested)
router.post(
  "/:workspaceId/invites",
  authenticate as never,
  authorizeWorkspace(["admin", "owner"]),
  validate(createInviteSchema),
  inviteController.createInviteCode
);

router.get(
  "/:workspaceId/invites",
  authenticate as never,
  authorizeWorkspace(["admin", "owner"]),
  inviteController.getWorkspaceInvites
);

router.delete(
  "/:workspaceId/invites/:inviteId",
  authenticate as never,
  authorizeWorkspace(["admin", "owner"]),
  inviteController.deleteInvite
);

export { router as workspaceRoutes };
