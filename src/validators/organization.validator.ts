import Joi from "joi";
import { DEFAULT_CATEGORIES } from "../models/organization.model";

// ─────────────────────────────────────────────────────
// Organization Validation Schemas
// ─────────────────────────────────────────────────────

/** Password: at least one uppercase, one lowercase, one digit */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export const registerOrgSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.min": "Organization name must be at least 2 characters",
    "string.max": "Organization name cannot exceed 100 characters",
    "string.empty": "Organization name is required",
    "any.required": "Organization name is required",
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
  category: Joi.string().trim().min(2).max(100).required().messages({
    "string.min": "Category must be at least 2 characters",
    "string.max": "Category cannot exceed 100 characters",
    "string.empty": "Category is required",
    "any.required": "Category is required",
  }),
  roles: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .default([])
    .messages({
      "array.base": "Roles must be an array of strings",
    }),
});

export const addRoleSchema = Joi.object({
  role: Joi.string().trim().min(1).max(50).required().messages({
    "string.min": "Role name is required",
    "string.max": "Role name cannot exceed 50 characters",
    "string.empty": "Role name is required",
    "any.required": "Role name is required",
  }),
});
