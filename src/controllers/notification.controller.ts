import { Response } from "express";
import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/notification.model";
import { IAuthenticatedRequest } from "../types/request.types";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { NotFoundError } from "../errors";

/**
 * Get all notifications for the authenticated user
 */
export const getNotifications = catchAsync(async (req: IAuthenticatedRequest, res: Response) => {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unreadOnly = "false" } = req.query;

    const query: any = { recipientId: new Types.ObjectId(userId) };
    if (unreadOnly === "true") {
        query.isRead = false;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate("senderId", "name avatar"),
        Notification.countDocuments(query),
    ]);

    sendSuccess(res, {
        notifications,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
        },
    });
});

/**
 * Mark a specific notification as read
 */
export const markAsRead = catchAsync(async (req: IAuthenticatedRequest, res: Response) => {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
        { _id: new Types.ObjectId(notificationId), recipientId: new Types.ObjectId(userId) },
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        throw new NotFoundError("Notification not found");
    }

    sendSuccess(res, { notification });
});

/**
 * Mark all notifications for the user as read
 */
export const markAllAsRead = catchAsync(async (req: IAuthenticatedRequest, res: Response) => {
    const userId = req.user.userId;

    await Notification.updateMany(
        { recipientId: new Types.ObjectId(userId), isRead: false },
        { isRead: true }
    );

    sendSuccess(res, { message: "All notifications marked as read" });
});

/**
 * Internal helper to create and send a notification
 */
export const createAndSendNotification = async (
    req: any,
    data: {
        recipientId: string | Types.ObjectId;
        senderId: string | Types.ObjectId;
        type: NotificationType;
        title: string;
        message: string;
        metadata?: Record<string, any>;
    }
) => {
    const notification = await Notification.create({
        ...data,
        recipientId: new Types.ObjectId(data.recipientId),
        senderId: new Types.ObjectId(data.senderId),
    });

    const populatedNotification = await notification.populate("senderId", "name avatar");

    // Emit via socket
    const io = req.app.get("io");
    if (io) {
        io.to(`user_${data.recipientId.toString()}`).emit("new-notification", populatedNotification);
    }

    return populatedNotification;
};

