import mongoose, { Schema, Document } from "mongoose";

// ─────────────────────────────────────────────────────────
// Invite Code Model
// ─────────────────────────────────────────────────────────

export interface IInviteCode extends Document {
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  code: string;
  expiresAt: Date;
  createdBy: mongoose.Types.ObjectId;
  maxUses: number;
  uses: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const inviteCodeSchema = new Schema<IInviteCode>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    maxUses: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    uses: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for expiry cleanup
inviteCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const InviteCode = mongoose.model<IInviteCode>(
  "InviteCode",
  inviteCodeSchema,
);
