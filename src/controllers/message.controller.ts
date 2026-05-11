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
        .populate("senderId", "name avatar")
        .populate({
            path: "replyTo",
            populate: { path: "senderId", select: "name avatar" }
        })
        .populate("reactions.users", "name avatar")
        .populate("pinnedBy", "name avatar");

    const nextCursor = messages.length === Number(limit) ? messages[messages.length - 1].createdAt : null;

    sendSuccess(res, { messages: messages.reverse(), nextCursor });
});

// Create a message (for REST fallback or direct creation)
export const createMessage = catchAsync(async (req: Request, res: Response) => {
    const { channelId, content, type, attachments, replyTo } = req.body;
    const user = (req as any).user;

    const message = await Message.create({
        senderId: user.userId,
        channelId: new Types.ObjectId(channelId),
        content,
        type,
        attachments,
        replyTo: replyTo ? new Types.ObjectId(replyTo) : null,
    });

    const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "name avatar")
        .populate({
            path: "replyTo",
            populate: { path: "senderId", select: "name avatar" }
        })
        .populate("reactions.users", "name avatar")
        .populate("pinnedBy", "name avatar");

    const io = req.app.get("io");
    if (io) {
        io.to(channelId).emit("new-message", populatedMessage);
    }

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

    const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "name avatar")
        .populate({
            path: "replyTo",
            populate: { path: "senderId", select: "name avatar" }
        })
        .populate("reactions.users", "name avatar")
        .populate("pinnedBy", "name avatar");

    const io = req.app.get("io");
    if (io && populatedMessage) {
        io.to(message.channelId.toString()).emit("message-updated", populatedMessage);
    }

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

    const io = req.app.get("io");
    if (io) {
        io.to(message.channelId.toString()).emit("message-deleted", { 
            messageId, 
            channelId: message.channelId 
        });
    }

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

// Send a voice message (upload + message creation)
export const sendVoiceMessage = catchAsync(async (req: Request, res: Response) => {
    const { channelId, replyTo } = req.body;
    const user = (req as any).user;

    if (!req.file) {
        return sendSuccess(res, { error: "No voice file provided" }, 400);
    }

    // 1. Upload to Cloudinary
    const { url, publicId, fileType } = await uploadToCloudinary(
        req.file.buffer,
        "synq-voice-messages"
    );

    // 2. Create the message
    const message = await Message.create({
        senderId: user.userId,
        channelId: new Types.ObjectId(channelId),
        content: "",
        type: "VOICE",
        attachments: [{
            url,
            name: req.file.originalname || "voice-message.webm",
            fileType: req.file.mimetype,
            // publicId, // The model doesn't seem to have publicId in attachments based on message.model.ts, but uploadMedia includes it in the response. Let's check the model again.
        }],
        replyTo: replyTo ? new Types.ObjectId(replyTo) : null,
    });

    // 3. Populate
    const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "name avatar")
        .populate({
            path: "replyTo",
            populate: { path: "senderId", select: "name avatar" }
        })
        .populate("reactions.users", "name avatar")
        .populate("pinnedBy", "name avatar");

    // 4. Emit via socket
    const io = req.app.get("io");
    if (io) {
        io.to(channelId).emit("new-message", populatedMessage);
    }

    sendSuccess(res, { message: populatedMessage }, 201);
});
