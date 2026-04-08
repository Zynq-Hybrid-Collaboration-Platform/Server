import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import * as taskController from "../controllers/task.controller";
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  unassignTaskSchema,
  updateStatusSchema,
} from "../validators/task.validator";

const router = Router();

// ─────────────────────────────────────────────────────────
// All routes require authentication
// ─────────────────────────────────────────────────────────

// GET  /tasks/my-tasks — tasks assigned to the current user
router.get(
  "/my-tasks",
  authenticate as never,
  taskController.getMyTasks,
);

// POST /tasks — create a new task (admin only, validated in controller)
router.post(
  "/",
  authenticate as never,
  validate(createTaskSchema) as never,
  taskController.createTask,
);

// GET  /tasks/channel/:channelId — list tasks in a channel (with filters)
router.get(
  "/channel/:channelId",
  authenticate as never,
  taskController.getTasksByChannel,
);

// GET  /tasks/workspace/:workspaceId — list tasks in a workspace
router.get(
  "/workspace/:workspaceId",
  authenticate as never,
  taskController.getTasksByWorkspace,
);

// GET  /tasks/:taskId — get a single task by ID
router.get(
  "/:taskId",
  authenticate as never,
  taskController.getTaskById,
);

// PATCH /tasks/:taskId — update task details (admin only)
router.patch(
  "/:taskId",
  authenticate as never,
  validate(updateTaskSchema) as never,
  taskController.updateTask,
);

// DELETE /tasks/:taskId — delete a task (admin only)
router.delete(
  "/:taskId",
  authenticate as never,
  taskController.deleteTask,
);

// PATCH /tasks/:taskId/assign — assign users to a task (admin only)
router.patch(
  "/:taskId/assign",
  authenticate as never,
  validate(assignTaskSchema) as never,
  taskController.assignTask,
);

// PATCH /tasks/:taskId/unassign — remove users from a task (admin only)
router.patch(
  "/:taskId/unassign",
  authenticate as never,
  validate(unassignTaskSchema) as never,
  taskController.unassignTask,
);

// PATCH /tasks/:taskId/status — change task status (assignee or admin)
router.patch(
  "/:taskId/status",
  authenticate as never,
  validate(updateStatusSchema) as never,
  taskController.updateTaskStatus,
);

export { router as taskRoutes };
