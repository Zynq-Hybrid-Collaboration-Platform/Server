import mongoose, { Schema, Document } from "mongoose";
import { MessageType, IReaction } from "../types/messaging.types";

/**
 * Reaction sub-schema (embedded array on each message).
 */
const reactionSchema = new Schema<IReaction>(
  {
    emoji: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export interface IMessageMongooseDoc extends Document {
  orgId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  type: MessageType;
  content: string;
  reactions: IReaction[];
  parentId: mongoose.Types.ObjectId | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message schema.
 *
 * Compound index on { orgId, channelId, createdAt: -1 } for
 * efficient cursor-based pagination within a channel.
 */
const messageSchema = new Schema<IMessageMongooseDoc>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
    content: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────

/** Primary query path: messages in a channel, newest first */
messageSchema.index({ orgId: 1, channelId: 1, createdAt: -1 });

/** Thread lookup: find replies to a parent message */
messageSchema.index({ parentId: 1, createdAt: 1 }, { sparse: true });

export const MessageModel = mongoose.model<IMessageMongooseDoc>(
  "Message",
  messageSchema
);
