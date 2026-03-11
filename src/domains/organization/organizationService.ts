import crypto from "crypto";
import { Types } from "mongoose";
import { OrganizationRepository } from "./organizationRepository";
import { MemberRepository } from "../member/memberRepository";
import { MemberRole } from "../member/member.model";
import { NotFoundError, AuthorizationError, ConflictError } from "../../core/errors";
import { channelService } from "../channel/channelService";

/** Character set for the org code suffix — uppercase alphanumeric only. */
const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** How many times to retry before giving up on code generation. */
const MAX_CODE_ATTEMPTS = 5;

export class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private memberRepository: MemberRepository,
  ) {}

  // ─────────────────────────────────────────────────────
  // Authenticated flows (caller must be a logged-in user)
  // ─────────────────────────────────────────────────────

  async createOrganization(
    userId: string,
    data: { name: string; slug: string },
  ) {
    const ownerObjectId = new Types.ObjectId(userId);

    const org = await this.organizationRepository.create({
      name: data.name,
      slug: data.slug,
      ownerId: ownerObjectId,
    });

    await this.memberRepository.addMember({
      userId: ownerObjectId,
      organizationId: org._id as Types.ObjectId,
      role: MemberRole.OWNER,
    });

    return org;
  }

  // ─────────────────────────────────────────────────────
  // Public flows (no authenticated user required)
  // ─────────────────────────────────────────────────────

  async registerOrganization(data: { name: string; slug?: string }) {
    const baseSlug = data.slug ?? this.slugify(data.name);
    const finalSlug = await this.resolveUniqueSlug(baseSlug);
    const organizationCode = await this.generateUniqueCode();

    const organization = await this.organizationRepository.create({
      name: data.name,
      slug: finalSlug,
      organizationCode,
    });

    return { organizationCode, organization };
  }

  async findByCode(code: string) {
    return this.organizationRepository.findByCode(code);
  }

  // ─────────────────────────────────────────────────────
  // Shared query methods
  // ─────────────────────────────────────────────────────

  async getUserOrganizations(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const memberships = await this.memberRepository.findByUserId(userObjectId);
    return memberships.map((m) => m.organizationId);
  }

  async getOrganization(orgId: string) {
    const orgObjectId = new Types.ObjectId(orgId);
    const organization =
      await this.organizationRepository.findById(orgObjectId);

    if (!organization) throw new NotFoundError("Organization not found");
    return organization;
  }

  async getSidebar(orgId: string) {
    const organization = await this.getOrganization(orgId);
    const allChannels = await channelService.getChannelsByOrganization(orgId);

    const categories = allChannels.filter((c) => c.type === "CATEGORY");
    const channels = allChannels.filter((c) => c.type !== "CATEGORY");

    return { organization, categories, channels };
  }

  async deleteOrganization(requestingUserId: string, orgId: string) {
    const organization = await this.getOrganization(orgId);

    // Check ownership (auth-updates model)
    if (organization.ownerId) {
      if (organization.ownerId.toString() !== requestingUserId) {
        throw new AuthorizationError(
          "You are not allowed to delete this organization",
        );
      }
    } else {
      // Fallback: first member in the array is the admin (main model)
      const isAdmin =
        organization.members.length > 0 &&
        organization.members[0].toString() === requestingUserId;

      if (!isAdmin) {
        throw new AuthorizationError(
          "Only the organization admin can delete this organization",
        );
      }
    }

    await this.organizationRepository.delete(organization._id as Types.ObjectId);
  }

  // ─────────────────────────────────────────────────────
  // Member management (from main)
  // ─────────────────────────────────────────────────────

  async addOrgMember(orgId: string, userId: string) {
    const org = await this.getOrganization(orgId);
    const userObjectId = new Types.ObjectId(userId);

    const alreadyMember = org.members.some(
      (memberId) => memberId.toString() === userId,
    );
    if (alreadyMember) {
      throw new ConflictError("User is already a member of this organization");
    }

    return this.organizationRepository.addMember(
      org._id as Types.ObjectId,
      userObjectId,
    );
  }

  async removeOrgMember(orgId: string, userId: string) {
    const org = await this.getOrganization(orgId);
    const userObjectId = new Types.ObjectId(userId);

    if (org.members.length > 0 && org.members[0].toString() === userId) {
      throw new AuthorizationError("Cannot remove the organization admin");
    }

    return this.organizationRepository.removeMember(
      org._id as Types.ObjectId,
      userObjectId,
    );
  }

  async getHomeData(userId: string) {
    const organizations = await this.getUserOrganizations(userId);
    return { organizations };
  }

  // ─────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async resolveUniqueSlug(baseSlug: string): Promise<string> {
    const taken = await this.organizationRepository.slugExists(baseSlug);
    if (!taken) return baseSlug;

    const suffix = crypto.randomBytes(3).toString("hex");
    return `${baseSlug}-${suffix}`;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const bytes = crypto.randomBytes(6);
      const suffix = Array.from(bytes)
        .map((b) => CODE_CHARS[b % CODE_CHARS.length])
        .join("");
      const code = `ORG-${suffix}`;

      const taken = await this.organizationRepository.codeExists(code);
      if (!taken) return code;
    }

    throw new Error(
      "Failed to generate a unique organization code — retry limit exceeded",
    );
  }
}
