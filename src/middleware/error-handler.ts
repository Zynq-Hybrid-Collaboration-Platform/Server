import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError } from "../errors/AppError";
import { logger } from "../logger/logger";
import { config } from "../config/env";

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error("Non-operational AppError", {
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
    }

    const errorResponse: Record<string, unknown> = {
      code: err.code,
      message: err.message,
    };
    if (err.details) {
      errorResponse.details = err.details;
    }

    res.status(err.statusCode).json({
      success: false,
      error: errorResponse,
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data validation failed",
        details,
      },
    });
    return;
  }

  const errRecord = err as unknown as Record<string, unknown>;
  if (errRecord.code === 11000) {
    const keyValue = (errRecord.keyValue as Record<string, unknown>) ?? {};
    const field = Object.keys(keyValue)[0] || "field";

    res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_KEY",
        message: `${field} already exists`,
      },
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ID",
        message: `Invalid ${err.path}: ${err.value}`,
      },
    });
    return;
  }

  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
      },
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_EXPIRED",
        message: "Authentication token has expired",
      },
    });
    return;
  }

  logger.error("Unhandled error", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: config.isProduction()
        ? "An unexpected error occurred"
        : err.message,
    },
  });
}
