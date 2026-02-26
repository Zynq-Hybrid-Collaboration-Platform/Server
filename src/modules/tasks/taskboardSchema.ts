import mongoose from "mongoose";

const taskBoardSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    columns: {
      type: [
        {
          id: {
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
          },
          name: { type: String, required: true },
          position: { type: Number, required: true },
        },
      ],
      default: [
        { id: "backlog", name: "Backlog", position: 0 },
        { id: "todo", name: "To Do", position: 1 },
        { id: "in-progress", name: "In Progress", position: 2 },
        { id: "code-review", name: "Code Review", position: 3 },
        { id: "testing", name: "Testing", position: 4 },
        { id: "deployment", name: "Deployment", position: 5 },
        { id: "completed", name: "Completed", position: 6 },
      ],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Tenant + Server lookup
taskBoardSchema.index({ orgId: 1, serverId: 1 });

export default mongoose.model("TaskBoard", taskBoardSchema);
