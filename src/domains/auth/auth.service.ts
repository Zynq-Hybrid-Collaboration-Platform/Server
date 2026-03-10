import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { AuthRepository } from "./auth.repository";
import {
  IRegisterDTO,
  ILoginDTO,
  IChangePasswordDTO,
  IForgotPasswordDTO,
  IResetPasswordDTO,
  IAuthResponse,
  IAuthTokens,
  IUserSafe,
  IUserLean,
  IRefreshTokenDTO,
  IGoogleAuthDTO,
  IAuthServiceInterface,
} from "./auth.types";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../core/errors";
import { config } from "../../core/config/env";
import { logger } from "../../core/logger/logger";
import { emailService } from "../../core/services/email.service";
import mongoose, { Types } from "mongoose";
import { OrganizationRepository } from "../organization/organizationRepository";
import { MemberRepository } from "../member/memberRepository";
import { MemberRole } from "../member/member.model";

const SALT_ROUNDS = 12;

/** Reset token expires in 1 hour */
const RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000;

/**
 * Auth Service — business logic layer (multi-org).
 *
 * Rules:
 * - ZERO HTTP awareness (no req, res, next)
 * - ZERO direct Mongoose calls (uses AuthRepository)
 * - Throws AppError subclasses (caught by globalErrorHandler)
 * - Returns typed responses (DTOs defined in auth.types.ts)
 *
 * Multi-org model:
 * - Users belong to multiple organizations (organizations[] array)
 * - Access token contains full organizations list for middleware checks
 * - Refresh token rotation: old token invalidated on each refresh
 * - Reset password: SHA-256 hashed token stored in DB
 */
export class AuthService implements IAuthServiceInterface {
  private authRepository: AuthRepository;
  private organizationRepository: OrganizationRepository;
  private memberRepository: MemberRepository;

  constructor(
    authRepository: AuthRepository,
    organizationRepository: OrganizationRepository,
    memberRepository: MemberRepository,
  ) {
    this.authRepository = authRepository;
    this.organizationRepository = organizationRepository;
    this.memberRepository = memberRepository;
  }

  // ─────────────────────────────────────────────────────
  // Public Auth Methods (called by auth.controller.ts)
  // ─────────────────────────────────────────────────────

  async register(dto: IRegisterDTO): Promise<IAuthResponse> {
    // ── Email uniqueness check ────────────────────────────────────────────
    const emailExists = await this.authRepository.existsByEmail(dto.email);
    if (emailExists) throw new ConflictError("User already exists");

    // ── Resolve username ──────────────────────────────────────────────────
    // Caller-supplied → validate uniqueness and use as-is.
    // Not supplied    → auto-generate from email prefix + 4-char hex suffix,
    //                   matching the strategy in createGoogleUser().
    const username = await this.resolveUsername(dto.username, dto.email);

    // ── Resolve organization ─────────────────────────────────────
    //
    // organizationCode path (new)  — look up org by ORG-XXXXXX code,
    //                                 validate it exists, then extract _id.
    // organizationId path   (old)  — caller supplies a raw ObjectId string;
    //                                 existing behaviour, unchanged.
    let resolvedOrgId: string | undefined;

    if (dto.organizationCode) {
      const org = await this.organizationRepository.findByCode(
        dto.organizationCode,
      );
      if (!org) throw new NotFoundError("Organization");
      resolvedOrgId = (org._id as Types.ObjectId).toString();
    } else if (dto.organizationId) {
      resolvedOrgId = dto.organizationId;
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // ── Atomic user + membership creation (MongoDB transaction) ────────
    //
    // Both the User document and the Member record must be written together.
    // If either write fails, withTransaction() rolls back both automatically,
    // preventing an orphaned User with no organization membership.
    const session = await mongoose.startSession();

    // TypeScript requires definite assignment; user is always set inside
    // withTransaction or the session throws before we reach the code below.
    let user!: Awaited<ReturnType<AuthRepository["create"]>>;

    try {
      await session.withTransaction(async () => {
        user = await this.authRepository.create(
          {
            name: dto.name,
            email: dto.email,
            username,
            password: hashedPassword,
            organizations: resolvedOrgId
              ? [{ orgId: resolvedOrgId, role: MemberRole.MEMBER }]
              : [],
          },
          session,
        );

        // Create the Member record only when an org was supplied via code.
        // The organizationId path (legacy) does not create a Member record
        // to preserve the existing behaviour of that flow.
        if (dto.organizationCode && resolvedOrgId) {
          await this.memberRepository.addMember(
            {
              userId: user._id,
              organizationId: new Types.ObjectId(resolvedOrgId),
              role: MemberRole.MEMBER,
            },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // ── Token issuance ────────────────────────────────────────────
    const tokens = this.generateTokenPair(
      user._id.toString(),
      user.organizations,
    );

    const hashedRefresh = this.hashToken(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(
      user._id.toString(),
      hashedRefresh,
    );

    logger.info("User registered", { userId: user._id, email: user.email });

    // Non-blocking — a welcome email failure must not abort a successful registration.
    emailService
      .sendWelcomeEmail(user.email, user.name)
      .catch((err) => logger.error("Failed to send welcome email", { err }));

    return { user: this.sanitizeUser(user), tokens };
  }

  async login(dto: ILoginDTO): Promise<IAuthResponse> {
    const user = await this.authRepository.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password!);
    if (!isPasswordValid) throw new AuthenticationError("Invalid email or password");

    const tokens = this.generateTokenPair(
      user._id.toString(),
      user.organizations
    );

    // Store hashed refresh token
    const hashedRefresh = this.hashToken(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(
      user._id.toString(),
      hashedRefresh
    );

    logger.info("User logged in", { userId: user._id });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async refreshToken(dto: IRefreshTokenDTO): Promise<IAuthTokens> {
    if (!dto.refreshToken) {
      throw new AuthenticationError("Refresh token is required");
    }

    // Verify refresh token signature
    let decoded: { id: string };
    try {
      decoded = jwt.verify(dto.refreshToken, config.JWT_REFRESH_SECRET, {
        algorithms: ["HS256"],
      }) as { id: string };
    } catch {
      throw new AuthenticationError("Invalid or expired refresh token");
    }

    // Fetch user with stored refresh token for rotation check
    const user = await this.authRepository.findByIdWithRefreshToken(decoded.id);
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    // Rotation detection: compare stored hash with incoming token
    const incomingHash = this.hashToken(dto.refreshToken);
    if (user.refreshToken && user.refreshToken !== incomingHash) {
      // Possible token reuse attack — invalidate all sessions
      await this.authRepository.updateRefreshToken(
        user._id.toString(),
        null
      );
      logger.warn("Refresh token reuse detected — all sessions invalidated", {
        userId: user._id,
      });
      throw new AuthenticationError(
        "Refresh token has been revoked — please log in again"
      );
    }

    // Issue new token pair
    const tokens = this.generateTokenPair(
      user._id.toString(),
      user.organizations
    );

    // Rotate: store new hashed refresh token
    const newHashedRefresh = this.hashToken(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(
      user._id.toString(),
      newHashedRefresh
    );

    logger.debug("Tokens refreshed", { userId: user._id });

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    // Invalidate refresh token — prevents reuse
    await this.authRepository.updateRefreshToken(userId, null);
    logger.info("User logged out", { userId });
  }

  async changePassword(
    userId: string,
    dto: IChangePasswordDTO
  ): Promise<void> {
    if (dto.currentPassword === dto.newPassword) {
      throw new ValidationError(
        "New password must be different from current password"
      );
    }

    const user = await this.authRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.password!
    );
    if (!isCurrentValid) {
      throw new AuthenticationError("Current password does not match");
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.authRepository.updatePassword(
      user._id.toString(),
      hashedPassword
    );

    // Invalidate refresh token on password change (force re-login)
    await this.authRepository.updateRefreshToken(user._id.toString(), null);

    logger.info("Password changed", { userId });
  }

  async forgotPassword(dto: IForgotPasswordDTO): Promise<string | null> {
    const user = await this.authRepository.findByEmail(dto.email);

    if (!user) {
      logger.debug("Forgot password request for non-existent email", {
        email: dto.email,
      });
      // Return null — controller always shows success (don't reveal existence)
      return null;
    }

    // Generate a cryptographically random reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);

    await this.authRepository.setResetToken(
      user._id.toString(),
      hashedToken,
      expires
    );

    logger.info("Password reset token generated", { userId: user._id });

    // Send the reset email with the raw token
    await emailService.sendPasswordResetEmail(user.email, rawToken, user.name);

    return rawToken;
  }

  async resetPassword(dto: IResetPasswordDTO): Promise<void> {
    // Hash the incoming token to match what's stored in DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(dto.token)
      .digest("hex");

    const user = await this.authRepository.findByResetToken(hashedToken);
    if (!user) {
      throw new AuthenticationError("Invalid or expired reset token");
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.authRepository.updatePassword(
      user._id.toString(),
      hashedPassword
    );

    // Clear reset token and invalidate refresh token
    await Promise.all([
      this.authRepository.clearResetToken(user._id.toString()),
      this.authRepository.updateRefreshToken(user._id.toString(), null),
    ]);

    logger.info("Password reset completed", { userId: user._id });
  }

  // ─────────────────────────────────────────────────────
  // Cross-Domain Service Interface
  // Other domains call these methods, never the repository.
  // ─────────────────────────────────────────────────────

  async findUserById(userId: string): Promise<IUserSafe | null> {
    const user = await this.authRepository.findById(userId);
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  async getUsersByIds(userIds: string[]): Promise<IUserSafe[]> {
    const users = await this.authRepository.findByIds(userIds);
    return users.map((u) => this.sanitizeUser(u));
  }

  async addOrganizationToUser(
    userId: string,
    orgId: string,
    role: string
  ): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Prevent duplicate membership
    const alreadyMember = user.organizations.some(
      (o) => o.orgId.toString() === orgId
    );
    if (alreadyMember) {
      throw new ConflictError("User is already a member of this organization");
    }

    await this.authRepository.addOrganization(userId, orgId, role);
    logger.info("Organization added to user", { userId, orgId, role });
  }

  async removeOrganizationFromUser(
    userId: string,
    orgId: string
  ): Promise<void> {
    await this.authRepository.removeOrganization(userId, orgId);
    logger.info("Organization removed from user", { userId, orgId });
  }

  // ─────────────────────────────────────────────────────
  // Google OAuth
  // ─────────────────────────────────────────────────────

  async googleLogin(dto: IGoogleAuthDTO): Promise<IAuthResponse> {
    // 1. Check by googleId first (returning user)
    let user = await this.authRepository.findByGoogleId(dto.googleId);

    if (!user) {
      // 2. Check if email already exists (link existing account)
      const existingUser = await this.authRepository.findByEmail(dto.email);

      if (existingUser) {
        await this.authRepository.linkGoogleId(existingUser._id.toString(), dto.googleId);
        user = { ...existingUser, googleId: dto.googleId };
      } else {
        // 3. Create brand new Google user
        const newUser = await this.authRepository.createGoogleUser(dto);
        user = newUser as unknown as IUserLean;
      }
    }

    const tokens = this.generateTokenPair(user._id.toString(), user.organizations);
    const hashedRefresh = this.hashToken(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(user._id.toString(), hashedRefresh);

    logger.info("Google login successful", { userId: user._id, email: user.email });

    return { user: this.sanitizeUser(user), tokens };
  }

  // ─────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────

  /**
   * Generate access + refresh token pair.
   *
   * Access token payload: { id, organizations }
   *   — organizations[] included so middleware can check membership without DB call.
   *
   * Refresh token payload: { id }
   *   — Minimal payload; full user data is fetched on refresh.
   */
  private generateTokenPair(
    userId: string,
    organizations: Array<{ orgId: { toString(): string }; role: string }>
  ): IAuthTokens {
    const accessOptions: SignOptions = {
      expiresIn: config.JWT_ACCESS_EXPIRES as SignOptions["expiresIn"],
      algorithm: "HS256",
    };
    const refreshOptions: SignOptions = {
      expiresIn: config.JWT_REFRESH_EXPIRES as SignOptions["expiresIn"],
      algorithm: "HS256",
    };

    const orgs = organizations.map((o) => ({
      orgId: o.orgId.toString(),
      role: o.role,
    }));

    const accessToken = jwt.sign(
      { id: userId, organizations: orgs },
      config.JWT_ACCESS_SECRET,
      accessOptions
    );

    const refreshToken = jwt.sign(
      { id: userId },
      config.JWT_REFRESH_SECRET,
      refreshOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * SHA-256 hash a token for secure storage.
   * Used for refresh tokens and reset tokens.
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Resolve the username for a new registration.
   *
   * Caller-supplied: checks uniqueness and returns it unchanged.
   * Auto-generated:  derives from the email prefix (alphanumeric only, lowercase,
   *                  max 20 chars) plus a 4-char random hex suffix — identical
   *                  strategy to createGoogleUser() in auth.repository.ts.
   *                  Retries up to 5 times on collision; falls back to a
   *                  12-char suffix (practically collision-proof).
   */
  private async resolveUsername(
    requested: string | undefined,
    email: string,
  ): Promise<string> {
    if (requested) {
      const taken = await this.authRepository.existsByUsername(requested);
      if (taken) throw new ConflictError("Username is already taken");
      return requested;
    }

    const prefix = email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 20);

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${prefix}_${crypto.randomBytes(2).toString("hex")}`;
      const taken = await this.authRepository.existsByUsername(candidate);
      if (!taken) return candidate;
    }

    // All 5 short-suffix attempts collided — use 6-byte suffix (astronomically rare)
    return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
  }

  /**
   * Strip sensitive fields from user document.
   * Password, refresh token, reset token are NEVER sent to client.
   */
  private sanitizeUser(
    user: IUserLean | { _id: { toString(): string }; name: string; email: string; username: string; avatar: string; status: string; organizations: Array<{ orgId: { toString(): string }; role: string; joinedAt: Date }> }
  ): IUserSafe {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      username: user.username ?? "",
      avatar: user.avatar,
      status: user.status,
      organizations: user.organizations.map((o) => ({
        orgId: o.orgId.toString(),
        role: o.role,
        joinedAt: o.joinedAt.toISOString(),
      })),
    };
  }
}
