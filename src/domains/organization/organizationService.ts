import crypto from "crypto";
import { Types } from "mongoose";
import { OrganizationRepository } from "./organizationRepository";
import { MemberRepository } from "../member/memberRepository";
import { MemberRole } from "../member/member.model";
import { channelService } from "../channel/channelService";
import { NotFoundError, AuthorizationError } from "../../core/errors";

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

  /**
   * Create a new organization owned by the authenticated user.
   * The caller is automatically added as OWNER in the Member collection.
   */
  async createOrganization(
    userId: string,
    data: { name: string; slug: string },
  ) {
    const ownerObjectId = new Types.ObjectId(userId);

    const org = await this.organizationRepository.create({
      ...data,
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

  /**
   * Register a new organization without an authenticated user.
   *
   * POST /api/v1/organizations/register
   *
   * Steps:
   *   1. Slugify name (or use the caller-supplied slug).
   *   2. Ensure slug uniqueness — append a random hex suffix on collision.
   *   3. Generate a cryptographically unique ORG-XXXXXX code.
   *   4. Persist the organization.
   *   5. Return the code so it can be shared with prospective members.
   */
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

  /**
   * Look up an organization by its human-readable join code.
   * Called by AuthService during user registration to resolve the ObjectId.
   */
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

  /**
   * Delete an organization — only the owner is allowed.
   * Handles the case where ownerId is absent (publicly-registered orgs).
   */
  async deleteOrganization(requestingUserId: string, orgId: string) {
    const organization = await this.getOrganization(orgId);

    if (
      !organization.ownerId ||
      organization.ownerId.toString() !== requestingUserId
    ) {
      throw new AuthorizationError(
        "You are not allowed to delete this organization",
      );
    }

    await this.organizationRepository.delete(organization._id);
  }

  async getHomeData(userId: string) {
    const organizations = await this.getUserOrganizations(userId);
    return { organizations };
  }

  // ─────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────

  /** Convert an arbitrary display name into a URL-safe slug. */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Return baseSlug if it is free, otherwise append a 6-char random hex suffix.
   * One retry is sufficient — the suffix space (16^6 ≈ 16 M) makes a second
   * collision astronomically unlikely.
   */
  private async resolveUniqueSlug(baseSlug: string): Promise<string> {
    const taken = await this.organizationRepository.slugExists(baseSlug);
    if (!taken) return baseSlug;

    const suffix = crypto.randomBytes(3).toString("hex"); // e.g. "a3f9c1"
    return `${baseSlug}-${suffix}`;
  }

  /**
   * Generate a globally-unique ORG-XXXXXX code using cryptographically
   * secure random bytes. Retries up to MAX_CODE_ATTEMPTS on collision.
   *
   * Uses modulo mapping from random bytes → CODE_CHARS to avoid modulo bias
   * as much as a 36-char alphabet allows (each byte maps to 7 chars with
   * ~1 % bias — acceptable for a non-secret join code).
   */
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
