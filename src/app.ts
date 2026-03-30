import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { globalErrorHandler } from "./middleware/error-handler";
import passport from "./config/passport";
import { registerRoutes } from "./routes";
import { config } from "./config/env";
import { logger } from "./logger/logger";

// Express application factory
export function createApp(): Application {
  const app = express();

  // Security & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    }),
  );

  // Body & Cookie Parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  // Request Logging (dev)
  if (config.isDevelopment()) {
    app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  // Health Check
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

  //  Routes

  registerRoutes(app);

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested endpoint does not exist",
      },
    });
  });

  // Global Error Handler
  app.use(globalErrorHandler);

  return app;
}
