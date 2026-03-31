import { Router } from "express";
import * as messageController from "../controllers/message.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Get messages for a channel
router.get("/:channelId", authenticate, messageController.getMessages);

// Create a message
router.post("/", authenticate, messageController.createMessage);

export { router as messageRoutes };
