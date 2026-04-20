import dotenv from "dotenv";

dotenv.config();

// ─────────────────────────────────────────────────────
// Env Helpers
// ─────────────────────────────────────────────────────

/**
 * Read a required environment variable.
 *
 * @throws {Error} If the variable is missing or empty — the process
 *   should fail fast at startup, not at runtime.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Read an optional environment variable with a fallback.
 *
 * @param key          – The env key to look up
 * @param defaultValue – Returned when the key is missing or empty
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// ─────────────────────────────────────────────────────
// Application Configuration
//
// All environment access is centralised here.
// No other file should read process.env directly.
//
// Config is frozen (`as const`) — any attempt to mutate
// at runtime will throw in strict mode.
// ─────────────────────────────────────────────────────

export const config = {
  // ── General ──────────────────────────────────────────
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  PORT: parseInt(optionalEnv("PORT", "3000"), 10),

  // ── Database ─────────────────────────────────────────
  MONGO_URI: requireEnv("MONGO_URI"),

  // ── JWT ──────────────────────────────────────────────
  JWT_ACCESS_SECRET: requireEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES: optionalEnv("JWT_ACCESS_EXPIRES", "15m"),
  JWT_REFRESH_EXPIRES: optionalEnv("JWT_REFRESH_EXPIRES", "7d"),

  // ── OAuth (optional — only needed when Google login is enabled) ──
  GOOGLE_CLIENT_ID: optionalEnv("GOOGLE_CLIENT_ID", ""),
  GOOGLE_CLIENT_SECRET: optionalEnv("GOOGLE_CLIENT_SECRET", ""),

  // ── SMTP / Email ─────────────────────────────────────
  // When SMTP_ENABLED is false (default), the email service
  // uses Ethereal in development (auto-preview URLs) and
  // skips sending entirely in production.
  SMTP_ENABLED: optionalEnv("SMTP_ENABLED", "false") === "true",
  SMTP_HOST: optionalEnv("SMTP_HOST", ""),
  SMTP_PORT: parseInt(optionalEnv("SMTP_PORT", "587"), 10),
  SMTP_USER: optionalEnv("SMTP_USER", ""),
  SMTP_PASS: optionalEnv("SMTP_PASS", ""),
  SMTP_FROM_NAME: optionalEnv("SMTP_FROM_NAME", "CollabHub"),
  SMTP_FROM_EMAIL: optionalEnv("SMTP_FROM_EMAIL", "noreply@collabhub.com"),

  // ── Frontend / CORS ──────────────────────────────────
  FRONTEND_URLS: optionalEnv("FRONTEND_URL", "http://localhost:3001").split(",").map(url => url.trim()),

  // ── Cloudinary ────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: optionalEnv("CLOUDINARY_CLOUD_NAME", ""),
  CLOUDINARY_API_KEY: optionalEnv("CLOUDINARY_API_KEY", ""),
  CLOUDINARY_API_SECRET: optionalEnv("CLOUDINARY_API_SECRET", ""),

  // ── Environment Predicates ───────────────────────────

  isDevelopment(): boolean {
    return this.NODE_ENV === "development";
  },

  isProduction(): boolean {
    return this.NODE_ENV === "production";
  },
} as const;
