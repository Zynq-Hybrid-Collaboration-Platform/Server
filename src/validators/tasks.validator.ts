import Joi from "joi";
import { TaskStatus, TaskPriority } from "../types/tasks.types";

/**
 * Task request validation schemas.
 * 
 * Fields are validated against TaskStatus and TaskPriority enums 
 * from src/types/tasks.types.ts to ensure data consistency.
 */

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const createTaskSchema = Joi.object({
  boardId: Joi.string().pattern(OBJECT_ID_PATTERN).required().messages({
    "string.pattern.base": "Invalid board ID format",
    "any.required": "Board ID is required",
  }),
  title: Joi.string().trim().min(1).max(200).required().messages({
    "string.empty": "Title is required",
    "string.max": "Title cannot exceed 200 characters",
    "any.required": "Title is required",
  }),
  description: Joi.string().trim().max(5000).allow("").optional(),
  status: Joi.string()
    .valid(...Object.values(TaskStatus))
    .optional(),
  priority: Joi.string()
    .valid(...Object.values(TaskPriority))
    .optional(),
  assigneeIds: Joi.array()
    .items(Joi.string().pattern(OBJECT_ID_PATTERN))
    .optional(),
  labels: Joi.array().items(Joi.string().trim()).optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
});

export const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(5000).allow("").optional(),
  priority: Joi.string()
    .valid(...Object.values(TaskPriority))
    .optional(),
  assigneeIds: Joi.array()
    .items(Joi.string().pattern(OBJECT_ID_PATTERN))
    .optional(),
  labels: Joi.array().items(Joi.string().trim()).optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
});

export const moveTaskSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(TaskStatus))
    .required()
    .messages({
      "any.only": "Invalid task status",
      "any.required": "Status is required for moving tasks",
    }),
  position: Joi.number().required().messages({
    "any.required": "Position is required for moving tasks",
  }),
});
