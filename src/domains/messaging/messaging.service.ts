import { EventEmitter } from "events";
import { MessagingRepository } from "./messaging.repository";
import {
  ICreateMessageDTO,
  IUpdateMessageDTO,
  IReactionDTO,
  IMessageSafe,
  IMessageLean,
  IPaginatedMessages,
  MessageEvent,
  MessageType,
} from "./messaging.types";
import {
  NotFoundError,
  AuthorizationError,
} from "../../core/errors";
import { logger } from "../../core/logger/logger";

/**
 * Messaging Service — business logic + domain events.
 *
 * Domain events are emitted via EventEmitter — no Socket.io coupling.
 * The transport layer (Socket.io gateway, SSE, etc.) subscribes to events
 * and pushes to clients. This keeps the service pure.
 */
export class MessagingService {
  private repository: MessagingRepository;
  readonly events: EventEmitter;

  constructor(repository: MessagingRepository) {
    this.repository = repository;
    this.events = new EventEmitter();
  }

  // ─────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────

  async getChannelMessages(
    orgId: string,
    channelId: string,
    cursor?: string,
    limit?: number
  ): Promise<IPaginatedMessages> {
    const { messages, hasMore } = await this.repository.findByChannel(
      orgId,
      channelId,
      cursor,
      limit
    );

    const safeMsgs = messages.map((m) => this.sanitize(m));
    const nextCursor =
      safeMsgs.length > 0
        ? safeMsgs[safeMsgs.length - 1].createdAt
        : null;

    return { messages: safeMsgs, nextCursor, hasMore };
  }

  async getThreadMessages(
    orgId: string,
    parentId: string,
    cursor?: string,
    limit?: number
  ): Promise<IPaginatedMessages> {
    const { messages, hasMore } = await this.repository.findThread(
      orgId,
      parentId,
      cursor,
      limit
    );

    const safeMsgs = messages.map((m) => this.sanitize(m));
    const nextCursor =
      safeMsgs.length > 0
        ? safeMsgs[safeMsgs.length - 1].createdAt
        : null;

    return { messages: safeMsgs, nextCursor, hasMore };
  }

  // ─────────────────────────────────────────────────────
  // Commands
  // ─────────────────────────────────────────────────────

  async createMessage(
    orgId: string,
    senderId: string,
    dto: ICreateMessageDTO
  ): Promise<IMessageSafe> {
    const message = await this.repository.create({
      orgId,
      channelId: dto.channelId,
      senderId,
      content: dto.content,
      type: dto.type ?? MessageType.TEXT,
      parentId: dto.parentId,
    });

    const safe = this.sanitize(message);

    this.events.emit(MessageEvent.CREATED, {
      orgId,
      channelId: dto.channelId,
      message: safe,
    });

    logger.debug("Message created", {
      messageId: safe.id,
      channelId: dto.channelId,
    });

    return safe;
  }

  async updateMessage(
    orgId: string,
    messageId: string,
    senderId: string,
    dto: IUpdateMessageDTO
  ): Promise<IMessageSafe> {
    // Verify ownership before update
    const existing = await this.repository.findById(orgId, messageId);
    if (!existing) {
      throw new NotFoundError("Message");
    }
    if (existing.senderId.toString() !== senderId) {
      throw new AuthorizationError("You can only edit your own messages");
    }

    const updated = await this.repository.updateContent(
      orgId,
      messageId,
      dto.content
    );
    if (!updated) {
      throw new NotFoundError("Message");
    }

    const safe = this.sanitize(updated);

    this.events.emit(MessageEvent.UPDATED, {
      orgId,
      channelId: safe.channelId,
      message: safe,
    });

    return safe;
  }

  async deleteMessage(
    orgId: string,
    messageId: string,
    senderId: string
  ): Promise<void> {
    const existing = await this.repository.findById(orgId, messageId);
    if (!existing) {
      throw new NotFoundError("Message");
    }
    if (existing.senderId.toString() !== senderId) {
      throw new AuthorizationError("You can only delete your own messages");
    }

    await this.repository.softDelete(orgId, messageId);

    this.events.emit(MessageEvent.DELETED, {
      orgId,
      channelId: existing.channelId.toString(),
      messageId,
    });

    logger.debug("Message deleted", { messageId });
  }

  async addReaction(
    orgId: string,
    messageId: string,
    userId: string,
    dto: IReactionDTO
  ): Promise<IMessageSafe> {
    const updated = await this.repository.addReaction(
      orgId,
      messageId,
      dto.emoji,
      userId
    );
    if (!updated) {
      throw new NotFoundError("Message");
    }

    const safe = this.sanitize(updated);

    this.events.emit(MessageEvent.REACTION_ADDED, {
      orgId,
      channelId: safe.channelId,
      messageId,
      emoji: dto.emoji,
      userId,
    });

    return safe;
  }

  async removeReaction(
    orgId: string,
    messageId: string,
    userId: string,
    dto: IReactionDTO
  ): Promise<IMessageSafe> {
    const updated = await this.repository.removeReaction(
      orgId,
      messageId,
      dto.emoji,
      userId
    );
    if (!updated) {
      throw new NotFoundError("Message");
    }

    const safe = this.sanitize(updated);

    this.events.emit(MessageEvent.REACTION_REMOVED, {
      orgId,
      channelId: safe.channelId,
      messageId,
      emoji: dto.emoji,
      userId,
    });

    return safe;
  }

  // ─────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────

  private sanitize(msg: IMessageLean): IMessageSafe {
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
}
