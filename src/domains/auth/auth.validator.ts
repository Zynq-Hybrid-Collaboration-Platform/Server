import Joi from "joi";

/**
 * Auth request validation schemas.
 *
 * These run BEFORE the controller via validate() middleware.
 * - abortEarly: false → returns ALL validation errors at once
 * - stripUnknown: true → removes fields not in schema (prevents mass assignment)
 *
 * After validation, req.body contains only whitelisted, sanitized fields.
 *
 * Security notes:
 * - Passwords: min 8 chars, must have uppercase + lowercase + digit (NIST baseline)
 * - Usernames: alphanumeric + underscore only (no dashes — prevents injection chars)
 * - OrganizationId: validated as 24-char hex (MongoDB ObjectId format)
 */

/** MongoDB ObjectId: exactly 24 hexadecimal characters */
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/** Username: alphanumeric + underscore only — no dashes, no spaces */
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/** Password: at least one uppercase, one lowercase, one digit */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    "string.min": "Name is required",
    "string.max": "Name cannot exceed 100 characters",
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.max": "Password cannot exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one digit",
      "string.empty": "Password is required",
      "any.required": "Password is required",
    }),
  username: Joi.string()
    .trim()
    .min(2)
    .max(30)
    .pattern(USERNAME_PATTERN)
    .optional()
    .messages({
      "string.min": "Username must be at least 2 characters",
      "string.max": "Username cannot exceed 30 characters",
      "string.pattern.base":
        "Username may only contain letters, numbers, and underscores",
      "string.empty": "Username cannot be empty if provided",
    }),
  organizationId: Joi.string().pattern(OBJECT_ID_PATTERN).optional().messages({
    "string.pattern.base": "Organization ID must be a valid identifier",
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  // No min length on login — don't give attackers clues about password policy
  password: Joi.string().max(128).required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(128).required().messages({
    "string.empty": "Current password is required",
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      "string.min": "New password must be at least 8 characters",
      "string.max": "New password cannot exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one digit",
      "string.empty": "New password is required",
      "any.required": "New password is required",
    }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.max": "Password cannot exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one digit",
      "string.empty": "New password is required",
      "any.required": "New password is required",
    }),
});

export const refreshTokenSchema = Joi.object({
  // Make optional in schema — controller falls back to cookie if absent
  refreshToken: Joi.string().optional().messages({
    "string.empty": "Refresh token cannot be empty",
  }),
});

// ─────────────────────────────────────────────────────
// Organization-linked registration
// ─────────────────────────────────────────────────────

/** Organization join code: ORG- followed by exactly 6 uppercase alphanumeric chars. */
const ORG_CODE_PATTERN = /^ORG-[A-Z0-9]{6}$/;

/**
 * Validates POST /api/v1/auth/register-user.
 *
 * Differences from registerSchema:
 *   - organizationCode is REQUIRED (user must belong to an org)
 *   - organizationId (internal ObjectId path) is NOT accepted here —
 *     only the public join code is exposed to external callers
 */
export const registerUserWithOrgSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    "string.min": "Name is required",
    "string.max": "Name cannot exceed 100 characters",
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.max": "Password cannot exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one digit",
      "string.empty": "Password is required",
      "any.required": "Password is required",
    }),
  username: Joi.string()
    .trim()
    .min(2)
    .max(30)
    .pattern(USERNAME_PATTERN)
    .optional()
    .messages({
      "string.min": "Username must be at least 2 characters",
      "string.max": "Username cannot exceed 30 characters",
      "string.pattern.base":
        "Username may only contain letters, numbers, and underscores",
      "string.empty": "Username cannot be empty if provided",
    }),
  organizationCode: Joi.string()
    .pattern(ORG_CODE_PATTERN)
    .required()
    .messages({
      "string.pattern.base":
        "Organization code must be in the format ORG-XXXXXX (uppercase letters and digits only)",
      "string.empty": "Organization code is required",
      "any.required": "Organization code is required",
    }),
});
