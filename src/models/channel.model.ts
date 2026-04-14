import mongoose, { Schema, Document } from "mongoose";

export enum ChannelType {
    TEXT = "TEXT",
    VOICE = "VOICE",
    AUDIO = "AUDIO",
    VIDEO = "VIDEO",
    TASKS = "TASKS",
}

export interface IChannel extends Document {
    name: string;
    type: ChannelType;
    workspaceId: mongoose.Types.ObjectId;
    parentId: mongoose.Types.ObjectId | null;
    order: number;
    allowedRoles: string[];
    members: mongoose.Types.ObjectId[];
}

const channelSchema = new Schema<IChannel>(
    {
        name: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: Object.values(ChannelType),
            default: ChannelType.TEXT,
        },
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: "Channel",
            default: null,
        },
        order: { type: Number, default: 0 },
        allowedRoles: { type: [String], default: [] },
        members: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    },
    { timestamps: true },
);

// Index for fetching all channels in a workspace
channelSchema.index({ workspaceId: 1, order: 1 });

export const Channel = mongoose.model<IChannel>("Channel", channelSchema);
