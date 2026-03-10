import Joi from "joi";

/**
 * Slug: lowercase alphanumeric segments separated by single hyphens.
 * Leading/trailing hyphens are rejected.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates POST /api/v1/organizations/register.
 *
 * - name   → required, trimmed
 * - slug   → optional; auto-generated from name when absent
 *
 * stripUnknown: true (applied by validate() middleware) — prevents any
 * extra fields from reaching the service layer.
 */
export const orgRegistrationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    "string.min": "Organization name is required",
    "string.max": "Organization name cannot exceed 100 characters",
    "string.empty": "Organization name is required",
    "any.required": "Organization name is required",
  }),
  slug: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .lowercase()
    .pattern(SLUG_PATTERN)
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters",
      "string.max": "Slug cannot exceed 50 characters",
      "string.pattern.base":
        "Slug may only contain lowercase letters, numbers, and hyphens",
    }),
});
