import { Types } from "mongoose";

// ─────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  SYSTEM = "system",
}

export enum MessageEvent {
  CREATED = "message.created",
  UPDATED = "message.updated",
  DELETED = "message.deleted",
  REACTION_ADDED = "message.reaction.added",
  REACTION_REMOVED = "message.reaction.removed",
}

// ─────────────────────────────────────────────────────────
// Sub-document types
// ─────────────────────────────────────────────────────────

export interface IReaction {
  emoji: string;
  userId: Types.ObjectId;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────
// Document + Lean types
// ─────────────────────────────────────────────────────────

export interface IMessageDocument {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  channelId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: MessageType;
  content: string;
  reactions: IReaction[];
  parentId: Types.ObjectId | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type IMessageLean = Pick<
  IMessageDocument,
  | "_id"
  | "orgId"
  | "channelId"
  | "senderId"
  | "type"
  | "content"
  | "reactions"
  | "parentId"
  | "isEdited"
  | "isDeleted"
  | "createdAt"
  | "updatedAt"
>;

// ─────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────

export interface ICreateMessageDTO {
  channelId: string;
  content: string;
  type?: MessageType;
  parentId?: string;
}

export interface IUpdateMessageDTO {
  content: string;
}

export interface IReactionDTO {
  emoji: string;
}

export interface IMessageListQuery {
  channelId: string;
  cursor?: string;
  limit?: number;
}

// ─────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────

export interface IMessageSafe {
  id: string;
  orgId: string;
  channelId: string;
  senderId: string;
  type: MessageType;
  content: string;
  reactions: Array<{ emoji: string; userId: string; createdAt: string }>;
  parentId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IPaginatedMessages {
  messages: IMessageSafe[];
  nextCursor: string | null;
  hasMore: boolean;
}
