import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

import { HttpError } from "../types/http-error.js";

type RequestSource = "body" | "params" | "query";

export const validate = (
  schema: ZodTypeAny,
  source: RequestSource = "body"
): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        new HttpError(400, "Validation failed", {
          fieldErrors: result.error.flatten().fieldErrors,
          formErrors: result.error.flatten().formErrors
        })
      );
      return;
    }

    Object.assign(req[source], result.data);
    next();
  };
};
