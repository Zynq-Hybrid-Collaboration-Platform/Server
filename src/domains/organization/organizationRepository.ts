import { Organization } from "./organization.model";
import { Types } from "mongoose";

export class OrganizationRepository {
  // Create Organization
  async create(data: { name: string; slug: string; ownerId: Types.ObjectId }) {
    return Organization.create(data);
  }
  //  Find by ID
  async findById(orgId: Types.ObjectId) {
    return Organization.findById(orgId);
  }

  //  Find by Slug
  async findBySlug(slug: string) {
    return Organization.findOne({ slug });
  }

  //  Get all organizations of a user (owner)
  async findByOwner(ownerId: Types.ObjectId) {
    return Organization.find({ ownerId });
  }
  //  Update organization
  async update(
    orgId: Types.ObjectId,
    updateData: Partial<{
      name: string;
      slug: string;
    }>,
  ) {
    return Organization.findByIdAndUpdate(orgId, updateData, { new: true });
  }

  //  Delete organization
  async delete(orgId: Types.ObjectId) {
    return Organization.findByIdAndDelete(orgId);
  }

  // Check if slug exists
  async slugExists(slug: string) {
    const org = await Organization.findOne({ slug });
    return !!org;
  }
}
