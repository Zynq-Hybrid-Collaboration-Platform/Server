import { Types } from "mongoose";
import * as orgRepo from "./organizationRepository";
import { NotFoundError, AuthorizationError, ConflictError } from "../../core/errors";

// ─────────────────────────────────────────────────────
// Business logic for the organization domain.
// ─────────────────────────────────────────────────────

/** Get all organizations where the user is a member */
export const getUserOrganizations = (userId: string) => {
  const userObjectId = new Types.ObjectId(userId);
  return orgRepo.findByMember(userObjectId);
};

/** Fetch a single organization by its _id. Throws if not found. */
export const getOrganization = async (orgId: string) => {
  const orgObjectId = new Types.ObjectId(orgId);
  const org = await orgRepo.findById(orgObjectId);

  if (!org) {
    throw new NotFoundError("Organization not found");
  }

  return org;
};

/** Delete an organization. Only the first member (admin) can delete. */
export const deleteOrganization = async (userId: string, orgId: string) => {
  const org = await getOrganization(orgId);

  // First member in the array is the creator (admin)
  const isAdmin =
    org.members.length > 0 && org.members[0].toString() === userId;

  if (!isAdmin) {
    throw new AuthorizationError(
      "Only the organization admin can delete this organization",
    );
  }

  await orgRepo.deleteOrg(org._id as Types.ObjectId);
};

/** Add a member to an organization */
export const addOrgMember = async (orgId: string, userId: string) => {
  const org = await getOrganization(orgId);
  const userObjectId = new Types.ObjectId(userId);

  // Check if already a member
  const alreadyMember = org.members.some(
    (memberId) => memberId.toString() === userId,
  );
  if (alreadyMember) {
    throw new ConflictError("User is already a member of this organization");
  }

  return orgRepo.addMember(org._id as Types.ObjectId, userObjectId);
};

/** Remove a member from an organization */
export const removeOrgMember = async (orgId: string, userId: string) => {
  const org = await getOrganization(orgId);
  const userObjectId = new Types.ObjectId(userId);

  // Cannot remove the first member (admin)
  if (org.members.length > 0 && org.members[0].toString() === userId) {
    throw new AuthorizationError("Cannot remove the organization admin");
  }

  return orgRepo.removeMember(org._id as Types.ObjectId, userObjectId);
};
