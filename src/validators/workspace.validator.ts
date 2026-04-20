import Joi from "joi";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const updateWorkspaceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).allow("").optional(),
  avatarUrl: Joi.string().uri().allow("").optional(),
}).min(1);

export const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid("admin", "member").required().messages({
    "any.only": "Role must be either 'admin' or 'member'",
    "any.required": "Role is required",
  }),
});

export const updatePermissionsSchema = Joi.object({
  membersCanCreateChannels: Joi.boolean().optional(),
  membersCanInvite: Joi.boolean().optional(),
  membersCanDeleteMessages: Joi.boolean().optional(),
}).min(1);

export const createInviteSchema = Joi.object({
  expiresIn: Joi.string()
    .trim()
    .pattern(/^(\d+h|\d+d)$/)
    .required()
    .messages({
      "string.pattern.base": "expiresIn must be in hours (e.g. '24h') or days (e.g. '7d')",
      "any.required": "expiresIn is required",
    }),
  maxUses: Joi.number().integer().min(0).optional().default(0), // 0 = unlimited
});
