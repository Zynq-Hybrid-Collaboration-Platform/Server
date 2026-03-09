import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  slug: string;
  ownerId?: mongoose.Types.ObjectId;  // optional — publicly-registered orgs have no owner yet
  organizationCode?: string;           // human-readable join code: ORG-XXXXXX
  membersCount: number;
  logo?: string;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    organizationCode: {
      type: String,
      unique: true,
      // sparse: only documents that have this field participate in the unique index.
      // Existing records without organizationCode are unaffected.
      sparse: true,
      index: true,
    },
    membersCount: { type: Number, default: 1 },
    logo: String,
  },
  { timestamps: true },
);

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema,
);
