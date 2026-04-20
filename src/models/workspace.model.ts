import mongoose, { Schema, Types, Document } from "mongoose";

export interface Workspace extends Document {
  orgId: Types.ObjectId;
  name: string;
  description?: string;
  avatarUrl?: string;
  permissions: {
    membersCanCreateChannels: boolean;
    membersCanInvite: boolean;
    membersCanDeleteMessages: boolean;
  };
  members: Array<{
    userId: Types.ObjectId;
    role: "owner" | "admin" | "member";
    joinedAt: Date;
  }>;
  createdAt: Date;
}

const WorkspaceSchema = new Schema<Workspace>({
  orgId: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  avatarUrl: {
    type: String,
    default: "",
  },
  permissions: {
    membersCanCreateChannels: { type: Boolean, default: true },
    membersCanInvite: { type: Boolean, default: true },
    membersCanDeleteMessages: { type: Boolean, default: true },
  },
  members: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      role: {
        type: String,
        enum: ["owner", "admin", "member"],
        default: "member",
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model<Workspace>("Workspace", WorkspaceSchema);
