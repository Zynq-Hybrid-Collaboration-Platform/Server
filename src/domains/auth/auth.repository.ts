import crypto from "crypto";
import mongoose from "mongoose";
import { UserModel } from "./auth.model";
import { IGoogleAuthDTO, IUserDocument, IUserLean } from "./auth.types";

/**
 * Auth Repository — the ONLY file in the auth domain that touches Mongoose.
 *
 * Rules:
 * - No business logic (that belongs in auth.service.ts)
 * - No HTTP awareness (no req/res)
 * - Explicit field whitelist on create (prevents mass assignment)
 * - .select("+field") used explicitly where hidden fields are needed
 * - .lean() used on read-only queries for performance (returns POJO, not Mongoose doc)
 */
export class AuthRepository {
  // ─────────────────────────────────────────────────────
  // Lookups
  // ─────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<IUserLean | null> {
    return UserModel.findOne({ email }).lean<IUserLean>();
  }

  async findByEmailWithPassword(email: string): Promise<IUserLean | null> {
    return UserModel.findOne({ email }).select("+password").lean<IUserLean>();
  }

  async findById(userId: string): Promise<IUserLean | null> {
    return UserModel.findById(userId).lean<IUserLean>();
  }

  async findByIds(userIds: string[]): Promise<IUserLean[]> {
    return UserModel.find({ _id: { $in: userIds } }).lean<IUserLean[]>();
  }

  async findByIdWithPassword(userId: string): Promise<IUserLean | null> {
    return UserModel.findById(userId).select("+password").lean<IUserLean>();
  }

  async findByIdWithRefreshToken(userId: string): Promise<IUserLean | null> {
    return UserModel.findById(userId)
      .select("+refreshToken")
      .lean<IUserLean>();
  }

  async findByResetToken(hashedToken: string): Promise<IUserLean | null> {
    return UserModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    })
      .select("+resetPasswordToken +resetPasswordExpires")
      .lean<IUserLean>();
  }

  async findByGoogleId(googleId: string): Promise<IUserLean | null> {
    return UserModel.findOne({ googleId })
      .select("+googleId")
      .lean<IUserLean>();
  }

  // ─────────────────────────────────────────────────────
  // Existence checks
  // ─────────────────────────────────────────────────────

  async existsByEmail(email: string): Promise<boolean> {
    const count = await UserModel.countDocuments({ email });
    return count > 0;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await UserModel.countDocuments({ username });
    return count > 0;
  }

  // ─────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────

  async create(
    data: {
      name: string;
      email: string;
      username: string;
      password: string;
      organizations: Array<{ orgId: string; role: string }>;
    },
    session?: mongoose.ClientSession,
  ): Promise<IUserDocument> {
    // UserModel.create([doc], { session }) is the Mongoose API for
    // transactional inserts — it returns an array, so destructure index 0.
    const [user] = await UserModel.create(
      [
        {
          name: data.name,
          email: data.email,
          username: data.username,
          password: data.password,
          organizations: data.organizations,
        },
      ],
      session ? { session } : undefined,
    );
    return user;
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { password: hashedPassword });
  }

  async updateRefreshToken(
    userId: string,
    hashedToken: string | null
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { refreshToken: hashedToken });
  }

  async setResetToken(
    userId: string,
    hashedToken: string,
    expires: Date
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expires,
    });
  }

  async clearResetToken(userId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
    });
  }

  // ─────────────────────────────────────────────────────
  // Organization membership
  // ─────────────────────────────────────────────────────

  async addOrganization(
    userId: string,
    orgId: string,
    role: string
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $push: { organizations: { orgId, role, joinedAt: new Date() } },
    });
  }

  async removeOrganization(userId: string, orgId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { organizations: { orgId } },
    });
  }

  async updateStatus(
    userId: string,
    status: "online" | "offline" | "idle"
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { status });
  }

  async createGoogleUser(data: IGoogleAuthDTO): Promise<IUserDocument> {
    const emailPrefix = data.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    const randomSuffix = crypto.randomBytes(2).toString("hex"); // 4 hex chars
    const username = `${emailPrefix}_${randomSuffix}`;

    return UserModel.create({
      name: data.name,
      email: data.email,
      googleId: data.googleId,
      avatar: data.avatar ?? "",
      username,
      organizations: [],
    });
  }

  async linkGoogleId(userId: string, googleId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { googleId });
  }
}
