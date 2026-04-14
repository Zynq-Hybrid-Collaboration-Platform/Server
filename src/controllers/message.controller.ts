import { Request, Response } from "express";
import { Message } from "../models/message.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Types } from "mongoose";
import { uploadToCloudinary } from "../middleware/upload.middleware";

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

// Update (edit) a message — only the sender can edit
export const updateMessage = catchAsync(async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const user = (req as any).user;

    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError("Message");

    if (message.senderId.toString() !== user.userId) {
        throw new ForbiddenError();
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    const populatedMessage = await Message.findById(message._id).populate("senderId", "name avatar");

    sendSuccess(res, { message: populatedMessage });
});

// Delete a message — only the sender can delete
export const deleteMessage = catchAsync(async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const user = (req as any).user;

    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError("Message");

    if (message.senderId.toString() !== user.userId) {
        throw new ForbiddenError();
    }

    await Message.findByIdAndDelete(messageId);

    sendSuccess(res, { messageId });
});

// Upload media to Cloudinary
export const uploadMedia = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
        return sendSuccess(res, { error: "No file provided" }, 400);
    }

    const { url, publicId, fileType } = await uploadToCloudinary(
        req.file.buffer,
        "synq-uploads"
    );

    sendSuccess(res, {
        attachment: {
            url,
            name: req.file.originalname,
            fileType: req.file.mimetype,
            publicId,
        },
    }, 201);
});
