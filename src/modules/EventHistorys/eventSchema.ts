import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["task_moved", "user_joined", "message_deleted"],
      required: true,
    },

    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Example:
      // { oldState: "todo", newState: "in-progress" }
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false },
);


eventSchema.index({ orgId: 1, timestamp: -1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
