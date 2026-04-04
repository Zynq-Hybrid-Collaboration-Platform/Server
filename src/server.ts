import http from "http";
import { createApp } from "./app";
import { connectDB, disconnectDB } from "./database/connection";
import { config } from "./config/env";
import { logger } from "./logger/logger";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./socket/socket.handler";
import { setupWebRTCHandlers } from "./socket/webrtc.handler";

/**
 * Server bootstrap.
 *
 * Startup order:
 * 1. Connect to MongoDB
 * 2. Create Express app (with all middleware + routes)
 * 3. Create HTTP server (needed later for Socket.io)
 * 4. Start listening
 * 5. Register graceful shutdown handlers
 */
async function bootstrap(): Promise<void> {
  // 1. Connect to database
  await connectDB();

  // 2. Create Express app
  const app = createApp();

  // 3. Create HTTP server and initialize Socket.io
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust this to your frontend URL in production
      methods: ["GET", "POST"],
    },
  });

  // Setup Socket handlers
  setupSocketHandlers(io);
  setupWebRTCHandlers(io);

  // 4. Start listening
  httpServer.listen(config.PORT, () => {
    logger.info(`API running on port ${config.PORT}`, {
      env: config.NODE_ENV,
      port: config.PORT,
    });
  });

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — starting graceful shutdown`);
    httpServer.close(async () => {
      logger.info("HTTP server closed");
      await disconnectDB();
      logger.info("All connections closed — exiting");
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long (10s)
    setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Catch unhandled errors at process level
  process.on("unhandledRejection", (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error("Unhandled Rejection", { message, stack });
  });

  process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught Exception", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  // Logger may not be available if config fails, fall back to console
  console.error("Failed to bootstrap server:", err);
  process.exit(1);
});
