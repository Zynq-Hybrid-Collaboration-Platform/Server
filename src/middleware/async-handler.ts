import { Request, Response, NextFunction } from "express";

/**
 * Wraps async route handlers to catch rejected promises
 * and forward them to Express error handler.
 */
export function catchAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
