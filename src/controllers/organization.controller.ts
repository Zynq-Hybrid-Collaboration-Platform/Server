import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { Organization, IOrganization } from "../models/organization.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { IAuthenticatedRequest } from "../types/request.types";
import {
  NotFoundError,
  AuthorizationError,
  ConflictError,
  ValidationError,
} from "../errors";
import { UserModel } from "../models/auth.model";

const SALT_ROUNDS = 12;

export const registerOrganization = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, category, roles } = req.body;
  
  const [nameExists, emailExists] = await Promise.all([
    Organization.findOne({ name }),
    Organization.findOne({ email }),
  ]);

  if (nameExists) throw new ConflictError("Organization name is already taken");
  if (emailExists) throw new ConflictError("Email is already registered");

  const effectiveRoles = roles || [];
  if (!effectiveRoles.includes("admin")) {
    effectiveRoles.unshift("admin");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const organization = await Organization.create({
    name,
    email,
    password: hashedPassword,
    category,
    roles: effectiveRoles,
  });

  sendSuccess(res, { organization }, 201);
});

export const getAllOrganizations = catchAsync(async (_req: Request, res: Response): Promise<void> => {
  const organizations = await Organization.find({}, { name: 1, category: 1 });
  sendSuccess(res, { organizations });
});

export const getUserOrganizations = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const authReq = req as IAuthenticatedRequest;
  const organizations = await Organization.find({ members: new Types.ObjectId(authReq.user.userId) });
  sendSuccess(res, { organizations });
});

export const getOrganization = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const organization = await Organization.findById(new Types.ObjectId(orgId));
  if (!organization) throw new NotFoundError("Organization not found");
  sendSuccess(res, { organization });
});

export const deleteOrganization = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const authReq = req as IAuthenticatedRequest;
  const { orgId } = req.params;
  
  const org = await Organization.findById(new Types.ObjectId(orgId));
  if (!org) throw new NotFoundError("Organization not found");

  const isAdmin = org.members.length > 0 && org.members[0].toString() === authReq.user.userId;
  if (!isAdmin) {
    throw new AuthorizationError("Only the organization admin can delete this organization");
  }

  await Organization.findByIdAndDelete(org._id);
  sendSuccess(res, { message: "Organization deleted successfully" });
});

export const addMember = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { userId } = req.body;
  
  const org = await Organization.findById(new Types.ObjectId(orgId));
  if (!org) throw new NotFoundError("Organization not found");

  const alreadyMember = org.members.some(m => m.toString() === userId);
  if (alreadyMember) throw new ConflictError("User is already a member of this organization");

  const updatedOrg = await Organization.findByIdAndUpdate(
    org._id,
    { $addToSet: { members: new Types.ObjectId(userId) } },
    { new: true }
  );

  sendSuccess(res, { message: "Member added successfully", organization: updatedOrg });
});

export const removeMember = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId, userId } = req.params;
  
  const org = await Organization.findById(new Types.ObjectId(orgId));
  if (!org) throw new NotFoundError("Organization not found");

  if (org.members.length > 0 && org.members[0].toString() === userId) {
    throw new AuthorizationError("Cannot remove the organization admin");
  }

  const updatedOrg = await Organization.findByIdAndUpdate(
    org._id,
    { $pull: { members: new Types.ObjectId(userId) } },
    { new: true }
  );

  sendSuccess(res, { message: "Member removed successfully", organization: updatedOrg });
});

export const getOrganizationMembers = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  
  const org = await Organization.findById(new Types.ObjectId(orgId));
  if (!org) throw new NotFoundError("Organization not found");

  const users = await UserModel.find({
    "organizations.orgId": new Types.ObjectId(orgId)
  }).select("name email username avatar organizations");

  const members = users.map(user => {
    const orgMembership = user.organizations.find(o => o.orgId.toString() === orgId);
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      role: orgMembership?.role || "member",
      joinedAt: orgMembership?.joinedAt
    };
  });

  sendSuccess(res, { members });
});

export const updateMemberRole = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const authReq = req as IAuthenticatedRequest;
  const { orgId, userId } = req.params;
  const { role } = req.body;
  
  const org = await Organization.findById(new Types.ObjectId(orgId));
  if (!org) throw new NotFoundError("Organization not found");

  const isAdmin = org.members.length > 0 && org.members[0].toString() === authReq.user.userId;
  const isOrgItself = authReq.user.userId === orgId;
  const userOrg = authReq.user.organizations?.find(o => o.orgId === orgId);
  
  if (!isAdmin && !isOrgItself && userOrg?.role !== "admin") {
    throw new AuthorizationError("Only organization admins can update roles");
  }

  if (!org.roles.includes(role)) {
    throw new ValidationError(`Role "${role}" is not available. Available roles: ${org.roles.join(", ")}`);
  }

  const targetUser = await UserModel.findById(new Types.ObjectId(userId));
  if (!targetUser) throw new NotFoundError("User not found");

  const orgMembershipIndex = targetUser.organizations.findIndex(o => o.orgId.toString() === orgId);
  if (orgMembershipIndex === -1) {
    throw new ConflictError("User is not a member of this organization");
  }

  await UserModel.updateOne(
    { _id: new Types.ObjectId(userId), "organizations.orgId": new Types.ObjectId(orgId) },
    { $set: { "organizations.$.role": role } }
  );

  sendSuccess(res, { message: "Role updated successfully" });
});

export const getOrgRoles = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const org = await Organization.findById(new Types.ObjectId(orgId), { roles: 1 });
  sendSuccess(res, { roles: org?.roles ?? [] });
});

export const addOrgRole = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { role } = req.body;
  
  const org = await Organization.findById(new Types.ObjectId(orgId));
  if (!org) throw new NotFoundError("Organization not found");

  if (org.roles.includes(role)) throw new ConflictError(`Role "${role}" already exists`);

  const updatedOrg = await Organization.findByIdAndUpdate(
    org._id,
    { $addToSet: { roles: role } },
    { new: true }
  );

  sendSuccess(res, { message: "Role added successfully", organization: updatedOrg });
});

export const removeOrgRole = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { orgId, role } = req.params;
  if (role === "admin") throw new AuthorizationError("Cannot remove the admin role");

  const org = await Organization.findById(new Types.ObjectId(orgId));
  if (!org) throw new NotFoundError("Organization not found");

  if (!org.roles.includes(role)) throw new NotFoundError(`Role "${role}" does not exist`);

  const updatedOrg = await Organization.findByIdAndUpdate(
    org._id,
    { $pull: { roles: role } },
    { new: true }
  );

  sendSuccess(res, { message: "Role removed successfully", organization: updatedOrg });
});
