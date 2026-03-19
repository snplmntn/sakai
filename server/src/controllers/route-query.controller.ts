import type { RequestHandler } from "express";

import type { AuthenticatedLocals } from "../middlewares/auth.middleware.js";
import * as routeQueryService from "../services/route-query.service.js";

export const queryRoutes: RequestHandler = async (req, res) => {
  const locals = res.locals as Partial<AuthenticatedLocals>;
  const result = await routeQueryService.queryRoutes({
    request: req.body,
    userId: locals.user?.id,
    accessToken: locals.accessToken
  });

  res.status(200).json({
    success: true,
    data: result
  });
};
