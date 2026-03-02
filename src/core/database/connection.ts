import mongoose from "mongoose";
import { config } from "../config/env";
import { logger } from "../logger/logger";

export async function connectDB(): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(config.MONGO_URI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error", { error: err.message });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    return conn;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("MongoDB connection failed", { error: message });
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
}
