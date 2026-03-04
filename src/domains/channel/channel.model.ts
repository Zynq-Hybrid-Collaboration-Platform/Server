import mongoose, { Schema, Document } from "mongoose";

export enum ChannelType {
    TEXT = "TEXT",
    VOICE = "VOICE",
    CATEGORY = "CATEGORY",
}

export interface IChannel extends Document {
    name: string;
    type: ChannelType;
    organizationId: mongoose.Types.ObjectId;
    parentId: mongoose.Types.ObjectId | null;
    order: number;
}

const channelSchema = new Schema<IChannel>(
    {
        name: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: Object.values(ChannelType),
            default: ChannelType.TEXT,
        },
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: "Channel",
            default: null,
        },
        order: { type: Number, default: 0 },
    },
    { timestamps: true },
);

// Index for fetching all channels in an organization
channelSchema.index({ organizationId: 1, order: 1 });

export const Channel = mongoose.model<IChannel>("Channel", channelSchema);
