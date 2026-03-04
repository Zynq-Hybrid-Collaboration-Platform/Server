import mongoose, { Schema, Document } from "mongoose";

export enum MemberRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MEMBER = "MEMBER",
}

export interface IMember extends Document {
    userId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    role: MemberRole;
    joinedAt: Date;
}

const memberSchema = new Schema<IMember>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
        role: {
            type: String,
            enum: Object.values(MemberRole),
            default: MemberRole.MEMBER,
        },
        joinedAt: { type: Date, default: Date.now },
    },
    { timestamps: true },
);

// Index for quick lookup of all organizations a user belongs to
memberSchema.index({ userId: 1 });
// Index for quick lookup of all members in an organization
memberSchema.index({ organizationId: 1 });
// Unique constraint to prevent duplicate memberships
memberSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const Member = mongoose.model<IMember>("Member", memberSchema);
