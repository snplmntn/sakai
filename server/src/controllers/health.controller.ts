import type { RequestHandler } from "express";

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running"
  });
};
