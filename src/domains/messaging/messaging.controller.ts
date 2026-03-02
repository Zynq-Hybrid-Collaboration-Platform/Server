import { Request, Response } from "express";
import { MessagingService } from "./messaging.service";
import { catchAsync } from "../../core/middleware/async-handler";
import { sendSuccess } from "../../core/utils/response";
import { ITenantRequest } from "../../core/types/request.types";

/**
 * Messaging Controller — HTTP transport layer.
 *
 * Every method expects req to be ITenantRequest (set by authenticate + extractTenant).
 * Uses tenantContext.orgId for all operations (tenant isolation).
 */
export class MessagingController {
  private messagingService: MessagingService;

  constructor(messagingService: MessagingService) {
    this.messagingService = messagingService;
  }

  /**
   * GET /api/v1/orgs/:orgId/channels/:channelId/messages
   * Query params: ?cursor=<ISO date>&limit=<number>
   */
  getMessages = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const tenantReq = req as unknown as ITenantRequest;
      const { channelId } = req.params;
      const cursor = req.query.cursor as string | undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined;

      const result = await this.messagingService.getChannelMessages(
        tenantReq.tenantContext.orgId,
        channelId,
        cursor,
        limit
      );

      sendSuccess(res, result);
    }
  );

  /**
   * GET /api/v1/orgs/:orgId/messages/:messageId/thread
   */
  getThread = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const tenantReq = req as unknown as ITenantRequest;
      const { messageId } = req.params;
      const cursor = req.query.cursor as string | undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined;

      const result = await this.messagingService.getThreadMessages(
        tenantReq.tenantContext.orgId,
        messageId,
        cursor,
        limit
      );

      sendSuccess(res, result);
    }
  );

  /**
   * POST /api/v1/orgs/:orgId/channels/:channelId/messages
   */
  createMessage = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const tenantReq = req as unknown as ITenantRequest;
      const { channelId } = req.params;
      const { content, type, parentId } = req.body;

      const message = await this.messagingService.createMessage(
        tenantReq.tenantContext.orgId,
        tenantReq.tenantContext.userId,
        { channelId, content, type, parentId }
      );

      sendSuccess(res, message, 201);
    }
  );

  /**
   * PATCH /api/v1/orgs/:orgId/messages/:messageId
   */
  updateMessage = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const tenantReq = req as unknown as ITenantRequest;
      const { messageId } = req.params;
      const { content } = req.body;

      const message = await this.messagingService.updateMessage(
        tenantReq.tenantContext.orgId,
        messageId,
        tenantReq.tenantContext.userId,
        { content }
      );

      sendSuccess(res, message);
    }
  );

  /**
   * DELETE /api/v1/orgs/:orgId/messages/:messageId
   */
  deleteMessage = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const tenantReq = req as unknown as ITenantRequest;
      const { messageId } = req.params;

      await this.messagingService.deleteMessage(
        tenantReq.tenantContext.orgId,
        messageId,
        tenantReq.tenantContext.userId
      );

      sendSuccess(res, { message: "Message deleted" });
    }
  );

  /**
   * POST /api/v1/orgs/:orgId/messages/:messageId/reactions
   */
  addReaction = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const tenantReq = req as unknown as ITenantRequest;
      const { messageId } = req.params;
      const { emoji } = req.body;

      const message = await this.messagingService.addReaction(
        tenantReq.tenantContext.orgId,
        messageId,
        tenantReq.tenantContext.userId,
        { emoji }
      );

      sendSuccess(res, message);
    }
  );

  /**
   * DELETE /api/v1/orgs/:orgId/messages/:messageId/reactions
   */
  removeReaction = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const tenantReq = req as unknown as ITenantRequest;
      const { messageId } = req.params;
      const { emoji } = req.body;

      const message = await this.messagingService.removeReaction(
        tenantReq.tenantContext.orgId,
        messageId,
        tenantReq.tenantContext.userId,
        { emoji }
      );

      sendSuccess(res, message);
    }
  );
}
