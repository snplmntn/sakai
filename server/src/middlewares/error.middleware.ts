import type { ErrorRequestHandler } from "express";

import { HttpError } from "../types/http-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details ?? null
    });
    return;
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  res.status(500).json({
    success: false,
    message: "Internal server error",
    details:
      process.env.NODE_ENV === "production"
        ? null
        : {
            reason: message
          }
  });
};
