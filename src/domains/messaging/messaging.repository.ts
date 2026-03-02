import { Types } from "mongoose";
import { MessageModel } from "./messaging.model";
import { IMessageLean, MessageType } from "./messaging.types";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Messaging Repository — the ONLY file in the messaging domain that touches Mongoose.
 *
 * Rules:
 * - No business logic
 * - No HTTP awareness
 * - All reads use .lean() for performance
 * - orgId is always required (tenant isolation)
 */
export class MessagingRepository {
  // ─────────────────────────────────────────────────────
  // Reads
  // ─────────────────────────────────────────────────────

  async findById(
    orgId: string,
    messageId: string
  ): Promise<IMessageLean | null> {
    return MessageModel.findOne({
      _id: messageId,
      orgId,
      isDeleted: false,
    }).lean<IMessageLean>();
  }

  /**
   * Cursor-based pagination for channel messages.
   *
   * If cursor is provided, fetches messages OLDER than the cursor.
   * Returns limit+1 results to determine hasMore, then slices to limit.
   */
  async findByChannel(
    orgId: string,
    channelId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE
  ): Promise<{ messages: IMessageLean[]; hasMore: boolean }> {
    const filter: Record<string, unknown> = {
      orgId: new Types.ObjectId(orgId),
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
      messages.pop(); // remove the extra item
    }

    return { messages, hasMore };
  }

  /**
   * Find thread replies to a parent message.
   */
  async findThread(
    orgId: string,
    parentId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE
  ): Promise<{ messages: IMessageLean[]; hasMore: boolean }> {
    const filter: Record<string, unknown> = {
      orgId: new Types.ObjectId(orgId),
      parentId: new Types.ObjectId(parentId),
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

    return { messages, hasMore };
  }

  // ─────────────────────────────────────────────────────
  // Writes
  // ─────────────────────────────────────────────────────

  async create(data: {
    orgId: string;
    channelId: string;
    senderId: string;
    content: string;
    type: MessageType;
    parentId?: string;
  }): Promise<IMessageLean> {
    const doc = await MessageModel.create({
      orgId: data.orgId,
      channelId: data.channelId,
      senderId: data.senderId,
      content: data.content,
      type: data.type,
      parentId: data.parentId || null,
    });

    // Return lean version for consistency
    return doc.toObject() as unknown as IMessageLean;
  }

  async updateContent(
    orgId: string,
    messageId: string,
    content: string
  ): Promise<IMessageLean | null> {
    return MessageModel.findOneAndUpdate(
      { _id: messageId, orgId, isDeleted: false },
      { content, isEdited: true },
      { new: true }
    ).lean<IMessageLean>();
  }

  /**
   * Soft delete — sets isDeleted: true, clears content.
   */
  async softDelete(
    orgId: string,
    messageId: string
  ): Promise<IMessageLean | null> {
    return MessageModel.findOneAndUpdate(
      { _id: messageId, orgId, isDeleted: false },
      { isDeleted: true, content: "[deleted]" },
      { new: true }
    ).lean<IMessageLean>();
  }

  // ─────────────────────────────────────────────────────
  // Reactions
  // ─────────────────────────────────────────────────────

  async addReaction(
    orgId: string,
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<IMessageLean | null> {
    return MessageModel.findOneAndUpdate(
      {
        _id: messageId,
        orgId,
        isDeleted: false,
        // Prevent duplicate reaction from same user with same emoji
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
  }

  async removeReaction(
    orgId: string,
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<IMessageLean | null> {
    return MessageModel.findOneAndUpdate(
      { _id: messageId, orgId },
      {
        $pull: {
          reactions: { emoji, userId: new Types.ObjectId(userId) },
        },
      },
      { new: true }
    ).lean<IMessageLean>();
  }
}
