import mongoose, { Schema, Types, Document } from "mongoose";

export interface Workspace extends Document {
  orgId: Types.ObjectId;
  name: string;
  members: Array<{
    userId: Types.ObjectId;
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
  members: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
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
