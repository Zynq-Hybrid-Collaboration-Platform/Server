import { Request, Response, NextFunction } from "express";

/**
 * Wraps async route handlers to catch rejected promises
 * and forward them to Express error handler.
 */
export function catchAsync<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as unknown as T, res, next)).catch(next);
  };
}
