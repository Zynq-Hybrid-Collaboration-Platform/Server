import Joi from "joi";

// ─────────────────────────────────────────────────────
// Invite Code Validation Schemas
// ─────────────────────────────────────────────────────

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const createInviteSchema = Joi.object({
  organizationId: Joi.string()
    .pattern(OBJECT_ID_PATTERN)
    .required()
    .messages({
      "string.pattern.base": "Organization ID must be a valid identifier",
      "any.required": "Organization ID is required",
    }),
  workspaceId: Joi.string()
    .pattern(OBJECT_ID_PATTERN)
    .required()
    .messages({
      "string.pattern.base": "Workspace ID must be a valid identifier",
      "any.required": "Workspace ID is required",
    }),
  expiresInHours: Joi.number()
    .integer()
    .min(1)
    .max(168) // max 7 days
    .required()
    .messages({
      "number.min": "Expiration must be at least 1 hour",
      "number.max": "Expiration cannot exceed 168 hours (7 days)",
      "any.required": "Expiration time is required",
    }),
  maxUses: Joi.number().integer().min(0).max(1000).default(0).messages({
    "number.min": "Max uses cannot be negative",
    "number.max": "Max uses cannot exceed 1000",
  }),
});
