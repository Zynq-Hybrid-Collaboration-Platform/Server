import mongoose from "mongoose";

const serverSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    inviteCode: {
      type: String,
      unique: true,
      sparse: true, // allows null but enforces uniqueness if exists
    },

    permissions: {
      roleOverrides: {
        type: Map,
        of: [String],
        // example:
        // developer => ["read", "comment", "edit"]
      },
    },
  },
  { timestamps: true },
);

serverSchema.index({ orgId: 1, workspaceId: 1 });

serverSchema.index({ inviteCode: 1 });

serverSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

const Server = mongoose.model("Server", serverSchema);

export default Server;
