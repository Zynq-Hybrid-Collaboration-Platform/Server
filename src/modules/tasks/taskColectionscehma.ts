import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskBoard",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    state: {
      type: String,
      enum: [
        "backlog",
        "todo",
        "in-progress",
        "code-review",
        "testing",
        "deployment",
        "completed",
      ],
      required: true,
      index: true,
    },

    position: {
      type: Number,
      required: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    labels: {
      type: [String],
      default: [],
    },

    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
  },
  { timestamps: true }
);

/* ======================
   IMPORTANT INDEXES
====================== */

// Kanban column load
taskSchema.index({ orgId: 1, boardId: 1, state: 1, position: 1 });

// My tasks
taskSchema.index({ orgId: 1, assigneeId: 1, state: 1 });

export default mongoose.model("Task", taskSchema);