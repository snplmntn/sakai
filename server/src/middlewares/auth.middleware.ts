import type { RequestHandler, Response } from "express";

import * as authModel from "../models/auth.model.js";
import type { AuthUser } from "../models/auth.model.js";
import { HttpError } from "../types/http-error.js";

export interface AuthenticatedLocals {
  accessToken: string;
  user: AuthUser;
}

const parseBearerToken = (authorizationHeader?: string): string => {
  if (!authorizationHeader) {
    throw new HttpError(401, "Missing authorization header");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Authorization header must use Bearer token format");
  }

  return token;
};

export const getAuthenticatedLocals = (
  res: Response
): AuthenticatedLocals => {
  const locals = res.locals as Partial<AuthenticatedLocals>;

  if (!locals.accessToken || !locals.user) {
    throw new HttpError(500, "Authenticated request context is missing");
  }

  return locals as AuthenticatedLocals;
};

export const authenticateRequest: RequestHandler = async (req, res, next) => {
  try {
    const accessToken = parseBearerToken(req.headers.authorization);
    const user = await authModel.getCurrentUser(accessToken);
    const locals = res.locals as Partial<AuthenticatedLocals>;

    locals.accessToken = accessToken;
    locals.user = user;

    next();
  } catch (error) {
    next(error);
  }
};
