import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as channelController from "../controllers/channel.controller";

const router = Router();

router.post("/", authenticate as never, channelController.createChannel);
router.get("/workspace/:workspaceId", authenticate as never, channelController.getChannelsByWorkspace);
router.patch("/:channelId", authenticate as never, channelController.updateChannel);
router.delete("/:channelId", authenticate as never, channelController.deleteChannel);

export { router as channelRoutes };
