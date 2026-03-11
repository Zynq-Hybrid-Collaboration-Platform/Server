import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  roles: string[];
  members: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const organizationSchema = new Schema<IOrganization>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },

  roles: {
    type: [String],
    default: ["admin", "developer", "designer", "qa", "product-manager"], //the role is dynamic can add from the ui these are the default
  },

  members: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema,
);
