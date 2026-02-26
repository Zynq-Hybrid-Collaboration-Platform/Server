import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true, // for URL usage
      lowercase: true,
      trim: true,
    },
    logo: {
      type: String, // S3 URL
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;
