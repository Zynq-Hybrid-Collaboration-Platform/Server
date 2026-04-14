import Joi from "joi";

// ─────────────────────────────────────────────────────────
// Task Validation Schemas
// ─────────────────────────────────────────────────────────

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const STATUSES = ["TODO", "ONGOING", "COMPLETED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/**
 * POST /tasks — create a new task
 */
export const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required().messages({
    "string.empty": "Task title is required",
    "string.max": "Task title cannot exceed 200 characters",
    "any.required": "Task title is required",
  }),

  description: Joi.string().trim().max(5000).allow("").default("").messages({
    "string.max": "Description cannot exceed 5000 characters",
  }),

  priority: Joi.string()
    .valid(...PRIORITIES)
    .default("MEDIUM")
    .messages({
      "any.only": `Priority must be one of: ${PRIORITIES.join(", ")}`,
    }),

  channelId: Joi.string().pattern(OBJECT_ID_PATTERN).required().messages({
    "string.pattern.base": "Channel ID must be a valid identifier",
    "any.required": "Channel ID is required",
  }),

  assignees: Joi.array()
    .items(
      Joi.string().pattern(OBJECT_ID_PATTERN).messages({
        "string.pattern.base": "Each assignee must be a valid user ID",
      }),
    )
    .default([])
    .messages({
      "array.base": "Assignees must be an array of user IDs",
    }),

  dueDate: Joi.date().iso().greater("now").allow(null).default(null).messages({
    "date.greater": "Due date must be in the future",
    "date.format": "Due date must be a valid ISO date",
  }),
});

/**
 * PATCH /tasks/:taskId — update task details (admin only)
 */
export const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).messages({
    "string.empty": "Task title cannot be empty",
    "string.max": "Task title cannot exceed 200 characters",
  }),

  description: Joi.string().trim().max(5000).allow("").messages({
    "string.max": "Description cannot exceed 5000 characters",
  }),

  priority: Joi.string()
    .valid(...PRIORITIES)
    .messages({
      "any.only": `Priority must be one of: ${PRIORITIES.join(", ")}`,
    }),

  dueDate: Joi.date().iso().allow(null).messages({
    "date.format": "Due date must be a valid ISO date",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

/**
 * PATCH /tasks/:taskId/assign — assign users to a task (admin only)
 */
export const assignTaskSchema = Joi.object({
  assignees: Joi.array()
    .items(
      Joi.string().pattern(OBJECT_ID_PATTERN).messages({
        "string.pattern.base": "Each assignee must be a valid user ID",
      }),
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one assignee is required",
      "any.required": "Assignees array is required",
    }),
});

/**
 * PATCH /tasks/:taskId/unassign — remove users from a task (admin only)
 */
export const unassignTaskSchema = Joi.object({
  assignees: Joi.array()
    .items(
      Joi.string().pattern(OBJECT_ID_PATTERN).messages({
        "string.pattern.base": "Each user ID must be a valid identifier",
      }),
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one user ID is required",
      "any.required": "Assignees array is required",
    }),
});

/**
 * PATCH /tasks/:taskId/status — change task status
 */
export const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...STATUSES)
    .required()
    .messages({
      "any.only": `Status must be one of: ${STATUSES.join(", ")}`,
      "any.required": "Status is required",
    }),
});
