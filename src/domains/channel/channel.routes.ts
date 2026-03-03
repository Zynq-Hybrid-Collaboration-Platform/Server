import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { channelController } from "./channel.controllers";

const router = Router();

// Base path: /api/v1/channels

router.post("/", authenticate as never, channelController.createChannel);
router.get("/org/:orgId", authenticate as never, channelController.getChannelsByOrganization);
router.patch("/:channelId", authenticate as never, channelController.updateChannel);
router.delete("/:channelId", authenticate as never, channelController.deleteChannel);

export { router as channelRoutes };
