import { Document, Types } from "mongoose";

// ─────────────────────────────────────────────────────────
// Organization Membership (embedded sub-document)
// ─────────────────────────────────────────────────────────

export interface IOrganizationMembership {
  orgId: Types.ObjectId;
  role: string;
  joinedAt: Date;
}

// ─────────────────────────────────────────────────────────
// Mongoose Document Interface
// ─────────────────────────────────────────────────────────

export interface IUserDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  username?: string;
  password?: string;
  googleId?: string;
  avatar: string;
  status: "online" | "offline" | "idle";
  organizations: IOrganizationMembership[];
  refreshToken: string;
  resetPasswordToken: string;
  resetPasswordExpires: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lean user — plain object returned by .lean().
 * Same shape as IUserDocument minus Mongoose document methods.
 */
export type IUserLean = Pick<
  IUserDocument,
  | "_id"
  | "name"
  | "email"
  | "username"
  | "password"
  | "googleId"
  | "avatar"
  | "status"
  | "organizations"
  | "refreshToken"
  | "resetPasswordToken"
  | "resetPasswordExpires"
  | "createdAt"
  | "updatedAt"
>;

// ─────────────────────────────────────────────────────────
// DTOs — what controllers extract from validated requests
// ─────────────────────────────────────────────────────────

export interface IRegisterDTO {
  name: string;
  email: string;
  password: string;
  username: string;
  organizationId: string;
}

export interface ILoginDTO {
  email: string;
  password: string;
}

export interface IChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface IForgotPasswordDTO {
  email: string;
}

export interface IResetPasswordDTO {
  token: string;
  newPassword: string;
}

export interface IRefreshTokenDTO {
  refreshToken: string;
}

export interface IGoogleAuthDTO {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
}

// ─────────────────────────────────────────────────────────
// Response Types — what services return to controllers
// ─────────────────────────────────────────────────────────

/** User data safe for API responses (no password, no sensitive fields) */
export interface IUserSafe {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar: string;
  status: string;
  organizations: Array<{ orgId: string; role: string; joinedAt: string }>;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthResponse {
  user: IUserSafe;
  tokens: IAuthTokens;
}

// ─────────────────────────────────────────────────────────
// Service Interface — public API for cross-domain consumers
// Other domains import this interface, NOT the repository or model.
// ─────────────────────────────────────────────────────────

export interface IAuthServiceInterface {
  findUserById(userId: string): Promise<IUserSafe | null>;
  getUsersByIds(userIds: string[]): Promise<IUserSafe[]>;
  addOrganizationToUser(
    userId: string,
    orgId: string,
    role: string
  ): Promise<void>;
  removeOrganizationFromUser(userId: string, orgId: string): Promise<void>;
  googleLogin(dto: IGoogleAuthDTO): Promise<IAuthResponse>;
}
