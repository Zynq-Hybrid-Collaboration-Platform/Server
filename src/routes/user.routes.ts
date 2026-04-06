import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as userController from "../controllers/user.controller";

const router = Router();

router.get("/profile", authenticate as never, userController.getProfile);

export { router as userRoutes };
