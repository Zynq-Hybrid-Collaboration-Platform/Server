import { Organization } from "./organization.model";
import { Types } from "mongoose";

export class OrganizationRepository {
  async create(data: {
    name: string;
    slug: string;
    ownerId?: Types.ObjectId;
    organizationCode?: string;
  }) {
    return Organization.create(data);
  }

  async findById(orgId: Types.ObjectId) {
    return Organization.findById(orgId);
  }

  async findBySlug(slug: string) {
    return Organization.findOne({ slug });
  }

  async findByName(name: string) {
    return Organization.findOne({ name });
  }

  async findByOwner(ownerId: Types.ObjectId) {
    return Organization.find({ ownerId });
  }

  async findByMember(userId: Types.ObjectId) {
    return Organization.find({ members: userId });
  }

  async update(
    orgId: Types.ObjectId,
    updateData: Partial<{ name: string; slug: string; roles: string[] }>,
  ) {
    return Organization.findByIdAndUpdate(orgId, updateData, { new: true });
  }

  async delete(orgId: Types.ObjectId) {
    return Organization.findByIdAndDelete(orgId);
  }

  async slugExists(slug: string): Promise<boolean> {
    return Organization.exists({ slug }).then(Boolean);
  }

  async findByCode(code: string) {
    return Organization.findOne({ organizationCode: code });
  }

  async codeExists(code: string): Promise<boolean> {
    return Organization.exists({ organizationCode: code }).then(Boolean);
  }

  async addMember(
    orgId: Types.ObjectId,
    userId: Types.ObjectId,
  ) {
    return Organization.findByIdAndUpdate(
      orgId,
      { $addToSet: { members: userId } },
      { new: true },
    );
  }

  async removeMember(
    orgId: Types.ObjectId,
    userId: Types.ObjectId,
  ) {
    return Organization.findByIdAndUpdate(
      orgId,
      { $pull: { members: userId } },
      { new: true },
    );
  }

  async addRole(orgId: Types.ObjectId, role: string) {
    return Organization.findByIdAndUpdate(
      orgId,
      { $addToSet: { roles: role } },
      { new: true },
    );
  }

  async removeRole(orgId: Types.ObjectId, role: string) {
    return Organization.findByIdAndUpdate(
      orgId,
      { $pull: { roles: role } },
      { new: true },
    );
  }
}
