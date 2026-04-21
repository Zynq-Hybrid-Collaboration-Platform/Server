import Joi from "joi";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const sendMessageSchema = Joi.object({
  channelId: Joi.string().pattern(OBJECT_ID_PATTERN).required(),
  content: Joi.string().trim().allow("").when("type", {
    is: Joi.string().valid("TEXT").default("TEXT"),
    then: Joi.string().required().min(1),
    otherwise: Joi.string().optional(),
  }),
  type: Joi.string().valid("TEXT", "IMAGE", "FILE", "STICKER", "GIF").default("TEXT"),
  attachments: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      name: Joi.string().required(),
      fileType: Joi.string().required(),
    })
  ).optional().default([]),
  replyTo: Joi.string().pattern(OBJECT_ID_PATTERN).allow(null).optional(),
});

export const pinMessageSchema = Joi.object({
  messageId: Joi.string().pattern(OBJECT_ID_PATTERN).required(),
  channelId: Joi.string().pattern(OBJECT_ID_PATTERN).required(),
  isPinned: Joi.boolean().required(),
});

export const reactMessageSchema = Joi.object({
  messageId: Joi.string().pattern(OBJECT_ID_PATTERN).required(),
  channelId: Joi.string().pattern(OBJECT_ID_PATTERN).required(),
  emoji: Joi.string().required(),
});
