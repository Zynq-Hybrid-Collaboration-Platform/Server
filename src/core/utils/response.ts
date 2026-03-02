import { Response } from "express";

/**
 * Send a standardized success response.
 * All successful API responses go through this for consistency.
 *
 * Shape: { success: true, data: T, meta?: {...} }
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): void {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}
