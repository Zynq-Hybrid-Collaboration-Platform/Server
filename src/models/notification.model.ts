import mongoose, { Schema, Document } from "mongoose";

export enum NotificationType {
    MESSAGE = "MESSAGE",
    MENTION = "MENTION",
    INVITE = "INVITE",
    TASK_ASSIGNED = "TASK_ASSIGNED",
    TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED",
    CALL_MISSED = "CALL_MISSED",
    WORKSPACE_JOIN = "WORKSPACE_JOIN",
    WORKSPACE_MEMBER_ADDED = "WORKSPACE_MEMBER_ADDED",
    WORKSPACE_ROLE_UPDATED = "WORKSPACE_ROLE_UPDATED",
    WORKSPACE_MEMBER_REMOVED = "WORKSPACE_MEMBER_REMOVED",
    WORKSPACE_DELETED = "WORKSPACE_DELETED",
    CHANNEL_CREATED = "CHANNEL_CREATED",
    CHANNEL_MEMBER_ADDED = "CHANNEL_MEMBER_ADDED",
    CHANNEL_MEMBER_REMOVED = "CHANNEL_MEMBER_REMOVED",
    CHANNEL_DELETED = "CHANNEL_DELETED",
    MESSAGE_REPLY = "MESSAGE_REPLY",
}

export interface INotification extends Document {
    recipientId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    metadata: Record<string, any>;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        recipientId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: Object.values(NotificationType),
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Indexes for performance
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
