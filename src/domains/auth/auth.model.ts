import mongoose, { Schema } from "mongoose";
import { IUserDocument } from "./auth.types";

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
  { _id: false }
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
      required: false,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      select: false,
    },
    googleId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
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
  }
);

// ─────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────

/** Fast lookup by org membership */
userSchema.index({ "organizations.orgId": 1 });

/** Sparse index — only documents with a reset token are indexed */
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });

/** Sparse index — only documents with a Google ID are indexed */
userSchema.index({ googleId: 1 }, { sparse: true });

export const UserModel = mongoose.model<IUserDocument>("User", userSchema);
