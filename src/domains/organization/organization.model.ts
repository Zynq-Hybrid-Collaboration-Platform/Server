import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  slug: string;
  ownerId?: mongoose.Types.ObjectId;
  organizationCode?: string;
  membersCount: number;
  logo?: string;
  roles: string[];
  members: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    organizationCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    membersCount: { type: Number, default: 1 },
    logo: String,
    roles: {
      type: [String],
      default: [
        "admin",
        "developer",
        "designer",
        "qa",
        "product-manager",
      ],
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
  },
);

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema,
);
