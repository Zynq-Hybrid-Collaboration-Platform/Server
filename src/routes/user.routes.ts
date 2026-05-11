import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as userController from "../controllers/user.controller";

const router = Router();

router.get("/profile", authenticate as never, userController.getProfile);
router.patch("/profile", authenticate as never, userController.updateProfile);
router.patch("/password", authenticate as never, userController.changePassword);
router.patch("/notifications", authenticate as never, userController.updateNotifications);
router.get("/:userId", authenticate as never, userController.getPublicProfile);
router.delete("/account", authenticate as never, userController.deleteAccount);

export { router as userRoutes };
