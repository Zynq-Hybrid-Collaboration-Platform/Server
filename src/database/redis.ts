import { createClient } from "redis";
import { config } from "../config/env";
import { logger } from "../logger/logger";

const redisClient = createClient({
    url: config.REDIS_URL
});

redisClient.on("error", (err) => logger.error("Redis Client Error", err));

export const connectRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        logger.info("Redis connected for state management");
    }
};

export const redis = redisClient;
