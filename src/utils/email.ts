import nodemailer, { Transporter, SentMessageInfo } from "nodemailer";
import { config } from "../config/env";
import { logger } from "../logger/logger";

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

/** Strongly typed envelope passed to the internal send() method. */
interface EmailEnvelope {
  to: string;
  subject: string;
  html: string;
}

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────

/** Ethereal SMTP host — free test inbox provided by the Nodemailer team. */
const ETHEREAL_HOST = "smtp.ethereal.email";
const ETHEREAL_PORT = 587;

/** Brand colour used across all email templates. */
const BRAND_COLOR = "#4F46E5";

// ─────────────────────────────────────────────────────
// HTML Template Builders
//
// Separated from the service class so they can be
// unit-tested independently and reused by future
// notification channels (e.g. in-app messages).
// ─────────────────────────────────────────────────────

/**
 * Wrap inner content in a consistent email layout shell.
 *
 * @param body – Raw HTML for the email body
 * @returns    – Complete HTML string with layout wrapper
 */
function emailLayout(body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${body}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">
        CollabHub — Collaborate better, together.
      </p>
    </div>
  `;
}

/**
 * Render a branded CTA (call-to-action) button.
 */
function ctaButton(label: string, href: string): string {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${href}"
         style="background-color: ${BRAND_COLOR}; color: white; padding: 12px 30px;
                text-decoration: none; border-radius: 6px; font-size: 16px;
                display: inline-block;">
        ${label}
      </a>
    </div>
  `;
}

/**
 * Build password-reset email HTML.
 */
function buildPasswordResetHtml(resetUrl: string, userName?: string): string {
  const greeting = userName ? `Hi ${userName},` : "Hi,";

  return emailLayout(`
    <h2 style="color: #333;">Password Reset</h2>
    <p>${greeting}</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    ${ctaButton("Reset Password", resetUrl)}
    <p style="color: #666; font-size: 14px;">
      This link will expire in <strong>1 hour</strong>.
    </p>
    <p style="color: #666; font-size: 14px;">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will remain unchanged.
    </p>
    <p style="color: #999; font-size: 12px;">
      If the button above doesn't work, copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color: ${BRAND_COLOR};">${resetUrl}</a>
    </p>
  `);
}

/**
 * Build welcome email HTML.
 */
function buildWelcomeHtml(userName: string): string {
  return emailLayout(`
    <h2 style="color: #333;">Welcome to CollabHub!</h2>
    <p>Hi ${userName},</p>
    <p>Your account has been created successfully. You're all set to start collaborating with your team.</p>
    ${ctaButton("Go to CollabHub", config.FRONTEND_URL)}
    <p style="color: #666; font-size: 14px;">
      If you didn't create this account, please contact our support team.
    </p>
  `);
}

// ─────────────────────────────────────────────────────
// Email Service
//
// Singleton responsible for all outgoing email.
//
// 3-mode delivery strategy (zero-config in development):
//
// ┌──────────────┬─────────────┬───────────────────────────────────────────┐
// │ SMTP_ENABLED │ NODE_ENV    │ Behaviour                                 │
// ├──────────────┼─────────────┼───────────────────────────────────────────┤
// │ false        │ development │ Ethereal test inbox — preview URLs logged │
// │ false        │ production  │ Warning logged — no email sent            │
// │ true         │ any         │ Real SMTP transport (Gmail, SES, etc.)    │
// └──────────────┴─────────────┴───────────────────────────────────────────┘
//
// Design decisions:
//   - Transporter is lazily created (first email triggers init)
//   - Race-condition-safe: concurrent sends share a single init promise
//   - Email failures are logged but NEVER thrown — they must not
//     break the calling business logic (auth flows, etc.)
// ─────────────────────────────────────────────────────

class EmailService {
  /** Cached transporter — created once per process lifetime. */
  private transporter: Transporter | null = null;

  /** Guards against parallel `createTransporter` calls during init. */
  private initPromise: Promise<Transporter | null> | null = null;

  // ─────────────────────────────────────────────────────
  // Transporter Lifecycle
  // ─────────────────────────────────────────────────────

  /**
   * Return the cached transporter, or create one if this is the first call.
   *
   * Uses a shared promise to prevent multiple concurrent initialisations —
   * e.g. simultaneous register + forgot-password during integration tests.
   */
  private async getTransporter(): Promise<Transporter | null> {
    if (this.transporter) return this.transporter;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.createTransporter();
    this.transporter = await this.initPromise;
    return this.transporter;
  }

  /**
   * Create the appropriate transporter for the current environment.
   *
   * Called at most once — result is cached by `getTransporter()`.
   */
  private async createTransporter(): Promise<Transporter | null> {
    // ── Real SMTP (production-ready) ─────────────────
    if (config.SMTP_ENABLED) {
      return this.createRealTransporter();
    }

    // ── Ethereal dev fallback ────────────────────────
    if (config.isDevelopment()) {
      return this.createEtherealTransporter();
    }

    // ── Production without SMTP — safe no-op ─────────
    logger.warn(
      "SMTP_ENABLED=false in production — no emails will be sent. " +
      "Set SMTP_ENABLED=true and configure credentials in .env."
    );
    return null;
  }

  /**
   * Create a transporter using real SMTP credentials from .env.
   *
   * Validates that all required fields are present before attempting
   * connection — fails fast with a clear error message.
   */
  private createRealTransporter(): Transporter | null {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = config;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      logger.error(
        "SMTP_ENABLED=true but credentials are incomplete — " +
        "check SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file. " +
        "Emails will NOT be sent."
      );
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // TLS on 465, STARTTLS on 587
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    logger.info("SMTP transporter created", { host: SMTP_HOST, port: SMTP_PORT });
    return transporter;
  }

  /**
   * Create an Ethereal test account transporter.
   *
   * Ethereal is a free fake SMTP inbox by the Nodemailer team.
   * Every sent email generates a preview URL that can be opened
   * in a browser to inspect the rendered result — perfect for dev.
   *
   * @see https://ethereal.email
   */
  private async createEtherealTransporter(): Promise<Transporter | null> {
    try {
      const testAccount = await nodemailer.createTestAccount();

      const transporter = nodemailer.createTransport({
        host: ETHEREAL_HOST,
        port: ETHEREAL_PORT,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });

      logger.info(
        "Ethereal test email account created — preview URLs will be logged for every email",
        { user: testAccount.user }
      );
      return transporter;
    } catch (error) {
      logger.warn(
        "Failed to create Ethereal test account — emails will be logged to console only",
        { error }
      );
      return null;
    }
  }

  // ─────────────────────────────────────────────────────
  // Core Send Method
  // ─────────────────────────────────────────────────────

  /**
   * Send a single email.
   *
   * - If no transporter is available, logs the email for debugging.
   * - If using Ethereal, logs a clickable preview URL.
   * - **Never throws** — email failures must not break calling code.
   */
  private async send(envelope: EmailEnvelope): Promise<void> {
    const from = `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL}>`;
    const transporter = await this.getTransporter();

    if (!transporter) {
      logger.info("Email (not sent — no transporter available)", {
        to: envelope.to,
        subject: envelope.subject,
        htmlPreview: envelope.html.substring(0, 200),
      });
      return;
    }

    try {
      const info: SentMessageInfo = await transporter.sendMail({
        from,
        to: envelope.to,
        subject: envelope.subject,
        html: envelope.html,
      });

      logger.info("Email sent successfully", {
        to: envelope.to,
        subject: envelope.subject,
        messageId: info.messageId,
      });

      // Ethereal provides a web preview URL — invaluable during dev
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`📧 Email preview: ${previewUrl}`);
      }
    } catch (error) {
      logger.error("Failed to send email — continuing without throwing", {
        to: envelope.to,
        subject: envelope.subject,
        error,
      });
    }
  }

  // ─────────────────────────────────────────────────────
  // Public API
  //
  // Each method builds a typed envelope and delegates to send().
  // Business logic should call these — never send() directly.
  // ─────────────────────────────────────────────────────

  /**
   * Send a password reset email containing a one-time reset link.
   *
   * The link points to the frontend's `/reset-password` page, which
   * will consume the raw token by calling `POST /auth/reset-password/:token`.
   *
   * @param to         – Recipient email address
   * @param resetToken – Raw (unhashed) reset token
   * @param userName   – Optional display name for the greeting
   */
  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    userName?: string
  ): Promise<void> {
    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await this.send({
      to,
      subject: "Password Reset Request — CollabHub",
      html: buildPasswordResetHtml(resetUrl, userName),
    });
  }

  /**
   * Send a welcome email after successful registration.
   *
   * Called non-blocking (fire-and-forget) from AuthService.register()
   * so registration speed is not affected by email delivery.
   *
   * @param to       – Recipient email address
   * @param userName – User's display name
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    await this.send({
      to,
      subject: "Welcome to CollabHub!",
      html: buildWelcomeHtml(userName),
    });
  }

  /**
   * Verify the SMTP connection (optional startup health check).
   *
   * Call from `server.ts` after DB connect if you want to confirm
   * email will work before accepting traffic.
   *
   * @returns `true` if connection verified, `false` otherwise
   */
  async verifyConnection(): Promise<boolean> {
    const transporter = await this.getTransporter();
    if (!transporter) return false;

    try {
      await transporter.verify();
      logger.info("SMTP connection verified — emails are ready");
      return true;
    } catch (error) {
      logger.error("SMTP connection verification failed", { error });
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────
// Singleton Export
//
// Usage:
//   import { emailService } from "../../core/services/email.service";
//   await emailService.sendWelcomeEmail(email, name);
// ─────────────────────────────────────────────────────
export const emailService = new EmailService();
