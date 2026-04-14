import mongoose, { Schema, Document } from "mongoose";

export enum MessageType {
    TEXT = "TEXT",
    IMAGE = "IMAGE",
    FILE = "FILE",
}

export interface IMessage extends Document {
    senderId: mongoose.Types.ObjectId;
    channelId: mongoose.Types.ObjectId;
    content: string;
    type: MessageType;
    isEdited: boolean;
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
    },
    { timestamps: true }
);

// Index for fast fetching of messages in a channel
messageSchema.index({ channelId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
