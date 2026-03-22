import type { RequestHandler, Response } from "express";

import * as authModel from "../models/auth.model.js";
import type { AuthUser } from "../models/auth.model.js";
import { HttpError } from "../types/http-error.js";

export interface AuthenticatedLocals {
  accessToken: string;
  user: AuthUser;
}

export const parseBearerToken = (authorizationHeader?: string): string => {
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

export const authenticateOptionalRequest: RequestHandler = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      next();
      return;
    }

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

const readRolesFromMetadata = (appMetadata: AuthUser["appMetadata"]): string[] => {
  if (!appMetadata || typeof appMetadata !== "object" || Array.isArray(appMetadata)) {
    return [];
  }

  const singleRole =
    typeof appMetadata.role === "string" && appMetadata.role.trim().length > 0
      ? [appMetadata.role.trim()]
      : [];
  const multipleRoles = Array.isArray(appMetadata.roles)
    ? appMetadata.roles.filter((role): role is string => typeof role === "string" && role.trim().length > 0)
    : [];

  return [...new Set([...singleRole, ...multipleRoles].map((role) => role.toLowerCase()))];
};

export const hasReviewerRole = (user: AuthUser): boolean => {
  const roles = readRolesFromMetadata(user.appMetadata);

  return roles.includes("reviewer") || roles.includes("admin");
};

export const requireReviewerRole: RequestHandler = (_req, res, next) => {
  try {
    const { user } = getAuthenticatedLocals(res);

    if (!hasReviewerRole(user)) {
      throw new HttpError(403, "Reviewer access is required");
    }

    next();
  } catch (error) {
    next(error);
  }
};
