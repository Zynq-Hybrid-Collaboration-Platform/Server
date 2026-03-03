import { Request, Response } from "express";
import { channelService } from "./channelService";
import { catchAsync } from "../../core/middleware/async-handler";
import { sendSuccess } from "../../core/utils/response";
import { IAuthenticatedRequest } from "../../core/types/request.types";

export class ChannelController {
    createChannel = catchAsync(
        async (req: Request, res: Response): Promise<void> => {
            const { name, type, organizationId, parentId } = req.body;
            const channel = await channelService.createChannel({
                name,
                type,
                organizationId,
                parentId,
            });
            sendSuccess(res, { channel }, 201);
        },
    );

    getChannelsByOrganization = catchAsync(
        async (req: Request, res: Response): Promise<void> => {
            const { orgId } = req.params;
            const channels = await channelService.getChannelsByOrganization(orgId);
            sendSuccess(res, { channels });
        },
    );

    updateChannel = catchAsync(
        async (req: Request, res: Response): Promise<void> => {
            const { channelId } = req.params;
            const channel = await channelService.updateChannel(channelId, req.body);
            sendSuccess(res, { channel });
        },
    );

    deleteChannel = catchAsync(
        async (req: Request, res: Response): Promise<void> => {
            const { channelId } = req.params;
            await channelService.deleteChannel(channelId);
            sendSuccess(res, { message: "Channel deleted successfully" });
        },
    );
}

export const channelController = new ChannelController();
