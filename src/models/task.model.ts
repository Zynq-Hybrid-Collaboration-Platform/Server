import mongoose, { Schema, Document } from "mongoose";

// ─────────────────────────────────────────────────────────
// Task Status & Priority Enums
// ─────────────────────────────────────────────────────────

export enum TaskStatus {
  TODO = "TODO",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

// ─────────────────────────────────────────────────────────
// Document Interface
// ─────────────────────────────────────────────────────────

export interface ITask extends Document {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  channelId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  assignees: mongoose.Types.ObjectId[];
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────

const taskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.TODO,
    },

    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },

    channelId: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },

    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    dueDate: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────

/** Fast lookup: all tasks in a channel, filterable by status */
taskSchema.index({ channelId: 1, status: 1 });

/** All tasks in a workspace */
taskSchema.index({ workspaceId: 1 });

/** Tasks assigned to a specific user */
taskSchema.index({ assignees: 1 });

/** Org-level tenant isolation */
taskSchema.index({ orgId: 1 });

export const Task = mongoose.model<ITask>("Task", taskSchema);
