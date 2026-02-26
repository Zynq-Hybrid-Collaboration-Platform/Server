import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
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
      lowercase: true,
    },

    type: {
      type: String,
      enum: ["text", "voice", "announcement"],
      default: "text",
    },

    isPrivate: {
      type: Boolean,
      default: false,
    },

    position: {
      type: Number, // for ordering in UI
      default: 0,
    },
  },
  { timestamps: true },
);

channelSchema.index({ serverId: 1, name: 1 }, { unique: true });

// Fast lookup
channelSchema.index({ orgId: 1, serverId: 1 });

const Channel = mongoose.model("Channel", channelSchema);

export default Channel;
