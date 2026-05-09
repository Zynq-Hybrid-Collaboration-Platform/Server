import { Router } from "express";
import * as statusController from "../controllers/status.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All status routes require authentication
router.use(authenticate);

router.post("/", statusController.createStatus);
router.get("/workspace/:workspaceId", statusController.getStatusesByWorkspace);
router.put("/:statusId", statusController.updateStatus);
router.delete("/:statusId", statusController.deleteStatus);

export default router;
