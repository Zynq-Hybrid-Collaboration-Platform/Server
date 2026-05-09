import mongoose, { Schema, Document } from "mongoose";

export interface IStatus extends Document {
  name: string;
  workspaceId: mongoose.Types.ObjectId;
  isCompleted: boolean;
  order: number;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const statusSchema = new Schema<IStatus>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      default: "#cbd5e1", // Default slate color
    },
  },
  { timestamps: true }
);

// Index for fast lookup by workspace and ordering
statusSchema.index({ workspaceId: 1, order: 1 });

export const Status = mongoose.model<IStatus>("Status", statusSchema);
