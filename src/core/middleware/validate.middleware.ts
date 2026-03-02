import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ValidationError } from "../errors/ValidationError";

/**
 * Generic Joi validation middleware factory.
 *
 * @param schema - Joi schema to validate against
 * @param source - Which part of the request to validate (body, params, query)
 *
 * Usage in routes:
 *   router.post("/register", validate(registerSchema), controller.register);
 */
export function validate(
  schema: Joi.ObjectSchema,
  source: "body" | "params" | "query" = "body"
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // Return ALL errors, not just first
      stripUnknown: true, // Remove fields not in schema — prevents mass assignment
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      }));

      return next(new ValidationError("Validation failed", details));
    }

    // Replace request data with validated + sanitized version
    req[source] = value;
    next();
  };
}
