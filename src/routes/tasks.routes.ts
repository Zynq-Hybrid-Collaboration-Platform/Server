import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { extractTenant } from "../middleware/tenant.middleware";
import * as tasksController from "../controllers/tasks.controller";
import { validate } from "../middleware/validate.middleware";
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "../validators/tasks.validator";

const router = Router();

router.use(authenticate as never);
router.use(extractTenant as never);

router.post("/", validate(createTaskSchema), tasksController.createTask);
router.get("/board/:boardId", tasksController.getBoardTasks);
router.get("/:taskId", tasksController.getTask);
router.patch("/:taskId", validate(updateTaskSchema), tasksController.updateTask);
router.post("/:taskId/move", validate(moveTaskSchema), tasksController.moveTask);
router.delete("/:taskId", tasksController.deleteTask);

export { router as tasksRoutes };
