import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./core/config/passport.config";
import { globalErrorHandler } from "./core/middleware/error-handler";
import { registerRoutes } from "./routes";
import { config } from "./core/config/env";
import { logger } from "./core/logger/logger";

/**
 * Express application factory.
 *
 * Creates and configures the Express app with:
 * - Security headers (helmet)
 * - CORS (configured for frontend origin)
 * - Body parsing (JSON + URL-encoded)
 * - Cookie parsing (for httpOnly token cookies)
 * - Health check endpoint
 * - All domain routes (via registerRoutes)
 * - 404 handler
 * - Global error handler
 *
 * Separated from server.ts for testability — you can import createApp()
 * in tests without starting an HTTP server.
 */
export function createApp(): Application {
  const app = express();

  // --- Security ---
  app.use(helmet());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    })
  );

  // --- Body Parsing ---
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  // --- Request Logging (dev only) ---
  if (config.isDevelopment()) {
    app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  // --- Health Check (no auth, no tenant — always accessible) ---
  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  });

  // --- Domain Routes ---
  registerRoutes(app);

  // --- 404 Handler (after all routes) ---
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested endpoint does not exis just typed now t",
      },
    });
  });

  // --- Global Error Handler (MUST be last middleware) ---
  app.use(globalErrorHandler);

  return app;
}
