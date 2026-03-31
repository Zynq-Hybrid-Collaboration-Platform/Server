import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ValidationError } from "../errors/ValidationError";

export function validate(
  schema: Joi.ObjectSchema,
  source: "body" | "params" | "query" = "body"
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      }));
      return next(new ValidationError("Validation failed", details));
    }
    req[source] = value;
    next();
  };
}
