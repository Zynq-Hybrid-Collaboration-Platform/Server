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

  async findByOwner(ownerId: Types.ObjectId) {
    return Organization.find({ ownerId });
  }

  async update(
    orgId: Types.ObjectId,
    updateData: Partial<{ name: string; slug: string }>,
  ) {
    return Organization.findByIdAndUpdate(orgId, updateData, { new: true });
  }

  async delete(orgId: Types.ObjectId) {
    return Organization.findByIdAndDelete(orgId);
  }

  async slugExists(slug: string): Promise<boolean> {
    return Organization.exists({ slug }).then(Boolean);
  }

  // ── New: organization code lookups ──────────────────────────────

  /** Find an organization by its human-readable join code (ORG-XXXXXX). */
  async findByCode(code: string) {
    return Organization.findOne({ organizationCode: code });
  }

  /** Returns true if the code is already taken. Uses indexed exists() query. */
  async codeExists(code: string): Promise<boolean> {
    return Organization.exists({ organizationCode: code }).then(Boolean);
  }
}
