import { Router } from "express";
import * as workspaceController from "../controllers/workspace.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate as never, workspaceController.createWorkspaceController);
router.get("/:workspaceId", authenticate as never, workspaceController.getWorkspaceByIdController);
router.get("/org/:orgId", authenticate as never, workspaceController.getWorkspacesByOrgController);
router.put("/:workspaceId", authenticate as never, workspaceController.updateWorkspaceController);
router.delete("/:workspaceId", authenticate as never, workspaceController.deleteWorkspaceController);
router.post("/:workspaceId/members", authenticate as never, workspaceController.addMemberController);
router.delete("/:workspaceId/members/:userId", authenticate as never, workspaceController.removeMemberController);
router.get("/:workspaceId/members", authenticate as never, workspaceController.getWorkspaceMembersController);

export { router as workspaceRoutes };
