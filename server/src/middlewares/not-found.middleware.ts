import type { RequestHandler } from "express";

import { HttpError } from "../types/http-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`));
};
