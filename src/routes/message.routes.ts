import { Router } from "express";
import * as messageController from "../controllers/message.controller";
import { authenticate } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

// Get messages for a channel
router.get("/:channelId", authenticate, messageController.getMessages);

// Create a message
router.post("/", authenticate, messageController.createMessage);

// Edit a message
router.put("/:messageId", authenticate, messageController.updateMessage);

// Delete a message
router.delete("/:messageId", authenticate, messageController.deleteMessage);

// Upload media to Cloudinary
router.post("/upload", authenticate, upload.single("file"), messageController.uploadMedia);

export { router as messageRoutes };
