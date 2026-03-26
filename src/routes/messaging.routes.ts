import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { extractTenant } from "../middleware/tenant.middleware";
import { requireChannelAccess } from "../middleware/channel-access.middleware";
import * as messagingController from "../controllers/messaging.controller";

const router = Router({ mergeParams: true });

router.use(authenticate as never);
router.use(extractTenant as never);

// Channels/Messages
router.get("/channels/:channelId/messages", requireChannelAccess as never, messagingController.getMessages);
router.post("/channels/:channelId/messages", requireChannelAccess as never, messagingController.createMessage);

// Threads
router.get("/messages/:messageId/thread", messagingController.getThread);

// Message operations
router.patch("/messages/:messageId", messagingController.updateMessage);
router.delete("/messages/:messageId", messagingController.deleteMessage);

// Reactions
router.post("/messages/:messageId/reactions", messagingController.addReaction);
router.delete("/messages/:messageId/reactions", messagingController.removeReaction);

export { router as messagingRoutes };
