import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["manager", "team_lead", "member"],
          default: "member",
        },
      },
    ],
  },
  { timestamps: true },
);
workspaceSchema.index({ orgId: 1, slug: 1 }, { unique: true });
workspaceSchema.index({ orgId: 1, "members.userId": 1 });

export default mongoose.model("Workspace", workspaceSchema);
