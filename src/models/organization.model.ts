import mongoose, { Schema, Document } from "mongoose";

// ─────────────────────────────────────────────────────────
// Default organization categories
// ─────────────────────────────────────────────────────────

export const DEFAULT_CATEGORIES = [
  "Software Company",
  "Marketing Agency",
  "Design Studio",
  "Startup",
  "Enterprise",
  "Education",
  "Consulting",
  "Other",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

// ─────────────────────────────────────────────────────────
// Mongoose Document Interface
// ─────────────────────────────────────────────────────────

export interface IOrganization extends Document {
  name: string;
  email: string;
  password: string;
  category: string;
  roles: string[];
  members: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    roles: {
      type: [String],
      default: [],
    },

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
  },
  {
    timestamps: true,
  },
);

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema,
);
