import mongoose, { Schema, Document } from "mongoose";

export enum MessageType {
    TEXT = "TEXT",
    IMAGE = "IMAGE",
    FILE = "FILE",
    STICKER = "STICKER",
    GIF = "GIF",
}

export interface IMessage extends Document {
    senderId: mongoose.Types.ObjectId;
    channelId: mongoose.Types.ObjectId;
    content: string;
    type: MessageType;
    isEdited: boolean;
    isPinned: boolean;
    pinnedAt: Date | null;
    pinnedBy: mongoose.Types.ObjectId | null;
    reactions: {
        emoji: string;
        users: mongoose.Types.ObjectId[];
    }[];
    replyTo: mongoose.Types.ObjectId | null;
    attachments: {
        url: string;
        name: string;
        fileType: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
    {
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        channelId: {
            type: Schema.Types.ObjectId,
            ref: "Channel",
            required: true,
        },
        content: {
            type: String,
            trim: true,
            default: "",
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        type: {
            type: String,
            enum: Object.values(MessageType),
            default: MessageType.TEXT,
        },
        attachments: [
            {
                url: String,
                name: String,
                fileType: String,
            },
        ],
        isPinned: {
            type: Boolean,
            default: false,
        },
        pinnedAt: {
            type: Date,
            default: null,
        },
        pinnedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reactions: [
            {
                emoji: {
                    type: String,
                    required: true,
                },
                users: [
                    {
                        type: Schema.Types.ObjectId,
                        ref: "User",
                    },
                ],
            },
        ],
        replyTo: {
            type: Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
    },
    { timestamps: true }
);

// Index for fast fetching of messages in a channel
messageSchema.index({ channelId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
