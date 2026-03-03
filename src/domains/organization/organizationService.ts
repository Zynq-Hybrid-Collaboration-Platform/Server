import { Types } from "mongoose";
import { OrganizationRepository } from "./organizationRepository";
import { MemberRepository } from "../member/memberRepository";
import { MemberRole } from "../member/member.model";
import { channelService } from "../channel/channelService";
import { NotFoundError, AuthorizationError } from "../../core/errors";

/**
 * OrganizationService
 *
 * This class contains **all business logic** for the organization domain.
 * It talks to the `OrganizationRepository` (database layer) and exposes
 * high‑level use cases used by controllers, such as:
 *
 * - Creating a new organization for a user
 * - Listing all organizations owned by a user
 * - Fetching a single organization
 * - Returning sidebar data
 * - Deleting an organization with ownership checks
 */
export class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private memberRepository: MemberRepository,
  ) {}
  /**
   * Create a new organization owned by the given user.
   *
   * Steps:
   * 1. Convert the userId string into a MongoDB ObjectId.
   * 2. Delegate the actual insert to the repository.
   * 3. Add the creator as the OWNER member.
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
    // Automatically add the creator as an OWNER in the membership collection
    await this.memberRepository.addMember({
      userId: ownerObjectId,
      organizationId: org._id as Types.ObjectId,
      role: MemberRole.OWNER,
    });
    return org;
  }

  /**
   * Return all organizations where the user is a member.
   */
  async getUserOrganizations(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const memberships = await this.memberRepository.findByUserId(userObjectId);
    return memberships.map((m) => m.organizationId);
  }

  /**
   * Fetch a single organization by its id.
   * Throws NotFoundError if it does not exist.
   */
  async getOrganization(orgId: string) {
    const orgObjectId = new Types.ObjectId(orgId);
    const organization =
      await this.organizationRepository.findById(orgObjectId);

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    return organization;
  }

  /**
   * Build sidebar data for an organization.
   *
   * Fetches real channels and groups them (basic structure for now).
   */
  async getSidebar(orgId: string) {
    const organization = await this.getOrganization(orgId);
    const allChannels = await channelService.getChannelsByOrganization(orgId);

    // Filter categories and channels
    const categories = allChannels.filter((c) => c.type === "CATEGORY");
    const channels = allChannels.filter((c) => c.type !== "CATEGORY");

    return {
      organization,
      categories,
      channels,
    };
  }

  /**
   * Delete an organization if the requesting user is the owner.
   *
   * - Verifies that the organization exists.
   * - Verifies that `requestingUserId` matches `organization.ownerId`.
   * - Delegates deletion to the repository.
   */
  async deleteOrganization(requestingUserId: string, orgId: string) {
    const organization = await this.getOrganization(orgId);

    if (organization.ownerId.toString() !== requestingUserId) {
      throw new AuthorizationError(
        "You are not allowed to delete this organization",
      );
    }

    await this.organizationRepository.delete(organization._id);
  }

  /**
   * Get homepage data: all organizations the user belongs to.
   */
  async getHomeData(userId: string) {
    const organizations = await this.getUserOrganizations(userId);
    return { organizations };
  }
}
