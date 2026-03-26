import { Request, Response } from "express";
import { EventEmitter } from "events";
import { Types } from "mongoose";
import { MessageModel } from "../models/messaging.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { ITenantRequest } from "../types/request.types";
import { logger } from "../logger/logger";
import {
  IMessageLean,
  IMessageSafe,
  MessageType,
  MessageEvent,
} from "../types/messaging.types";
import {
  NotFoundError,
  AuthorizationError,
} from "../errors";

const DEFAULT_PAGE_SIZE = 50;
export const events = new EventEmitter();

// ─────────────────────────────────────────────────────
// Private Helpers
// ─────────────────────────────────────────────────────

function sanitize(msg: IMessageLean): IMessageSafe {
  return {
    id: msg._id.toString(),
    orgId: msg.orgId.toString(),
    channelId: msg.channelId.toString(),
    senderId: msg.senderId.toString(),
    type: msg.type,
    content: msg.content,
    reactions: msg.reactions.map((r) => ({
      emoji: r.emoji,
      userId: r.userId.toString(),
      createdAt: r.createdAt.toISOString(),
    })),
    parentId: msg.parentId ? msg.parentId.toString() : null,
    isEdited: msg.isEdited,
    isDeleted: msg.isDeleted,
    createdAt: msg.createdAt.toISOString(),
    updatedAt: msg.updatedAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────

export const getMessages = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { channelId } = req.params;
  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : DEFAULT_PAGE_SIZE;

  const filter: Record<string, unknown> = {
    orgId: new Types.ObjectId(tenantReq.tenantContext.orgId),
    channelId: new Types.ObjectId(channelId),
    isDeleted: false,
  };

  if (cursor) {
    filter.createdAt = { $lt: new Date(cursor) };
  }

  const messages = await MessageModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean<IMessageLean[]>();

  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop();
  }

  const safeMsgs = messages.map((m) => sanitize(m));
  const nextCursor = safeMsgs.length > 0 ? safeMsgs[safeMsgs.length - 1].createdAt : null;

  sendSuccess(res, { messages: safeMsgs, nextCursor, hasMore });
});

export const getThread = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { messageId } = req.params;
  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : DEFAULT_PAGE_SIZE;

  const filter: Record<string, unknown> = {
    orgId: new Types.ObjectId(tenantReq.tenantContext.orgId),
    parentId: new Types.ObjectId(messageId),
    isDeleted: false,
  };

  if (cursor) {
    filter.createdAt = { $gt: new Date(cursor) };
  }

  const messages = await MessageModel.find(filter)
    .sort({ createdAt: 1 })
    .limit(limit + 1)
    .lean<IMessageLean[]>();

  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop();
  }

  const safeMsgs = messages.map((m) => sanitize(m));
  const nextCursor = safeMsgs.length > 0 ? safeMsgs[safeMsgs.length - 1].createdAt : null;

  sendSuccess(res, { messages: safeMsgs, nextCursor, hasMore });
});

export const createMessage = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { channelId } = req.params;
  const { content, type, parentId } = req.body;
  const orgId = tenantReq.tenantContext.orgId;
  const senderId = tenantReq.tenantContext.userId;

  const doc = await MessageModel.create({
    orgId,
    channelId,
    senderId,
    content,
    type: type ?? MessageType.TEXT,
    parentId: parentId || null,
  });

  const message = doc.toObject() as unknown as IMessageLean;
  const safe = sanitize(message);

  events.emit(MessageEvent.CREATED, {
    orgId,
    channelId,
    message: safe,
  });

  logger.debug("Message created", { messageId: safe.id, channelId });

  sendSuccess(res, safe, 201);
});

export const updateMessage = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { messageId } = req.params;
  const { content } = req.body;
  const orgId = tenantReq.tenantContext.orgId;
  const senderId = tenantReq.tenantContext.userId;

  const existing = await MessageModel.findOne({
    _id: messageId,
    orgId,
    isDeleted: false,
  }).lean<IMessageLean>();

  if (!existing) throw new NotFoundError("Message");
  if (existing.senderId.toString() !== senderId) throw new AuthorizationError("You can only edit your own messages");

  const updated = await MessageModel.findOneAndUpdate(
    { _id: messageId, orgId, isDeleted: false },
    { content, isEdited: true },
    { new: true }
  ).lean<IMessageLean>();

  if (!updated) throw new NotFoundError("Message");
  const safe = sanitize(updated);

  events.emit(MessageEvent.UPDATED, {
    orgId,
    channelId: safe.channelId,
    message: safe,
  });

  sendSuccess(res, safe);
});

export const deleteMessage = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { messageId } = req.params;
  const orgId = tenantReq.tenantContext.orgId;
  const senderId = tenantReq.tenantContext.userId;

  const existing = await MessageModel.findOne({
    _id: messageId,
    orgId,
    isDeleted: false,
  }).lean<IMessageLean>();

  if (!existing) throw new NotFoundError("Message");
  if (existing.senderId.toString() !== senderId) throw new AuthorizationError("You can only delete your own messages");

  await MessageModel.findOneAndUpdate(
    { _id: messageId, orgId, isDeleted: false },
    { isDeleted: true, content: "[deleted]" }
  );

  events.emit(MessageEvent.DELETED, {
    orgId,
    channelId: existing.channelId.toString(),
    messageId,
  });

  sendSuccess(res, { message: "Message deleted" });
});

export const addReaction = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { messageId } = req.params;
  const { emoji } = req.body;
  const orgId = tenantReq.tenantContext.orgId;
  const userId = tenantReq.tenantContext.userId;

  const updated = await MessageModel.findOneAndUpdate(
    {
      _id: messageId,
      orgId,
      isDeleted: false,
      "reactions.emoji": { $ne: emoji },
    },
    {
      $push: {
        reactions: {
          emoji,
          userId: new Types.ObjectId(userId),
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  ).lean<IMessageLean>();

  if (!updated) throw new NotFoundError("Message");
  const safe = sanitize(updated);

  events.emit(MessageEvent.REACTION_ADDED, {
    orgId,
    channelId: safe.channelId,
    messageId,
    emoji,
    userId,
  });

  sendSuccess(res, safe);
});

export const removeReaction = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { messageId } = req.params;
  const { emoji } = req.body;
  const orgId = tenantReq.tenantContext.orgId;
  const userId = tenantReq.tenantContext.userId;

  const updated = await MessageModel.findOneAndUpdate(
    { _id: messageId, orgId },
    {
      $pull: {
        reactions: { emoji: emoji, userId: new Types.ObjectId(userId) },
      },
    },
    { new: true }
  ).lean<IMessageLean>();

  if (!updated) throw new NotFoundError("Message");
  const safe = sanitize(updated);

  events.emit(MessageEvent.REACTION_REMOVED, {
    orgId,
    channelId: safe.channelId,
    messageId,
    emoji,
    userId,
  });

  sendSuccess(res, safe);
});
