import { Request, Response } from "express";
import { Message } from "../models/message.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { NotFoundError } from "../errors/NotFoundError";
import { Types } from "mongoose";

// Get messages for a channel with pagination
export const getMessages = catchAsync(async (req: Request, res: Response) => {
    const { channelId } = req.params;
    const { limit = 50, cursor } = req.query;

    const query: any = { channelId: new Types.ObjectId(channelId) };
    if (cursor) {
        query.createdAt = { $lt: new Date(cursor as string) };
    }

    const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .populate("senderId", "name avatar");

    const nextCursor = messages.length === Number(limit) ? messages[messages.length - 1].createdAt : null;

    sendSuccess(res, { messages: messages.reverse(), nextCursor });
});

// Create a message (for REST fallback or direct creation)
export const createMessage = catchAsync(async (req: Request, res: Response) => {
    const { channelId, content, type, attachments } = req.body;
    const user = (req as any).user;

    const message = await Message.create({
        senderId: user.userId,
        channelId: new Types.ObjectId(channelId),
        content,
        type,
        attachments,
    });

    const populatedMessage = await Message.findById(message._id).populate("senderId", "name avatar");

    sendSuccess(res, { message: populatedMessage }, 201);
});
