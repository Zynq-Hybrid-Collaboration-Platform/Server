import mongoose, { Schema, Document } from "mongoose";
import { TaskStatus, TaskPriority } from "./tasks.types";

export interface ITaskMongooseDoc extends Document {
  orgId: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeIds: mongoose.Types.ObjectId[];
  reporterId: mongoose.Types.ObjectId;
  labels: string[];
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task schema.
 *
 * Uses fractional positioning for drag-and-drop reordering:
 *   - position is a float between 0 and a large number
 *   - Moving a task between two others = (posAbove + posBelow) / 2
 *   - Rebalance when precision gets too low
 *
 * Compound index on { orgId, boardId, status, position } for column queries.
 */
const taskSchema = new Schema<ITaskMongooseDoc>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "TaskBoard",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 10000,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.BACKLOG,
    },
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.NONE,
    },
    position: {
      type: Number,
      required: true,
      default: 0,
    },
    assigneeIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    labels: {
      type: [String],
      default: [],
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────

/** Primary query path: tasks in a board column, sorted by position */
taskSchema.index({ orgId: 1, boardId: 1, status: 1, position: 1 });

/** Assignee lookup across all boards */
taskSchema.index({ orgId: 1, assigneeIds: 1 });

export const TaskModel = mongoose.model<ITaskMongooseDoc>("Task", taskSchema);
