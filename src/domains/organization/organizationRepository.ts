import { Organization } from "./organization.model";
import { Types } from "mongoose";

// ─────────────────────────────────────────────────────
// All database queries for the Organization collection.
// ─────────────────────────────────────────────────────

/** Find organization by _id */
export const findById = (orgId: Types.ObjectId) => {
  return Organization.findById(orgId);
};

/** Find organization by unique name */
export const findByName = (name: string) => {
  return Organization.findOne({ name });
};

/** Find all organizations that contain this userId in members[] */
export const findByMember = (userId: Types.ObjectId) => {
  return Organization.find({ members: userId });
};

/** Update organization fields (name, roles) */
export const updateOrg = (
  orgId: Types.ObjectId,
  updateData: Partial<{ name: string; roles: string[] }>,
) => {
  return Organization.findByIdAndUpdate(orgId, updateData, { new: true });
};

/** Delete organization by _id */
export const deleteOrg = (orgId: Types.ObjectId) => {
  return Organization.findByIdAndDelete(orgId);
};

/** Push a userId into the members array */
export const addMember = (orgId: Types.ObjectId, userId: Types.ObjectId) => {
  return Organization.findByIdAndUpdate(
    orgId,
    { $addToSet: { members: userId } },
    { new: true },
  );
};

/** Pull a userId from the members array */
export const removeMember = (orgId: Types.ObjectId, userId: Types.ObjectId) => {
  return Organization.findByIdAndUpdate(
    orgId,
    { $pull: { members: userId } },
    { new: true },
  );
};

/** Push a role string into the roles array */
export const addRole = (orgId: Types.ObjectId, role: string) => {
  return Organization.findByIdAndUpdate(
    orgId,
    { $addToSet: { roles: role } },
    { new: true },
  );
};

/** Pull a role string from the roles array */
export const removeRole = (orgId: Types.ObjectId, role: string) => {
  return Organization.findByIdAndUpdate(
    orgId,
    { $pull: { roles: role } },
    { new: true },
  );
};
