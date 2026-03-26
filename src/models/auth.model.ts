import mongoose, { Schema } from "mongoose";
import { IUserDocument } from "../types/auth.types";

/**
 * Organization membership sub-schema (embedded array).
 * Each entry represents one org the user belongs to, with their role in that org.
 */
const organizationMembershipSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role: {
      type: String,
      required: true,
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

/**
 * Workspace membership sub-schema (embedded array).
 */
const workspaceMembershipSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

/**
 * User schema — multi-organization model.
 *
 * Breaking change from Phase 1:
 *   organizationId (single ObjectId) → organizations[] (embedded array)
 *
 * New fields: name, refreshToken, resetPasswordToken, resetPasswordExpires.
 * Sensitive fields (password, refreshToken, resetPassword*) are select: false.
 */
const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["online", "offline", "idle"],
      default: "offline",
    },
    organizations: {
      type: [organizationMembershipSchema],
      default: [],
    },
    workspaces: {
      type: [workspaceMembershipSchema],
      default: [],
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────

/** Fast lookup by org membership */
userSchema.index({ "organizations.orgId": 1 });

/** Fast lookup by workspace membership */
userSchema.index({ "workspaces.workspaceId": 1 });

/** Sparse index — only documents with a reset token are indexed */
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });

export const UserModel = mongoose.model<IUserDocument>("User", userSchema);
