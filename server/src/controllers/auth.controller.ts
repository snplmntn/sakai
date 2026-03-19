import type { RequestHandler } from "express";

import * as authModel from "../models/auth.model.js";
import { HttpError } from "../types/http-error.js";

const getBearerToken = (authorizationHeader?: string): string => {
  if (!authorizationHeader) {
    throw new HttpError(401, "Missing authorization header");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Authorization header must use Bearer token format");
  }

  return token;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Authentication failed";
};

export const signUp: RequestHandler = async (req, res) => {
  const authPayload = await authModel.signUpWithEmailAndPassword(req.body);

  res.status(201).json({
    success: true,
    data: authPayload
  });
};

export const signIn: RequestHandler = async (req, res) => {
  const authPayload = await authModel.signInWithEmailAndPassword(req.body);

  res.status(200).json({
    success: true,
    data: authPayload
  });
};

export const refreshSession: RequestHandler = async (req, res) => {
  const authPayload = await authModel.refreshAuthSession(req.body);

  res.status(200).json({
    success: true,
    data: authPayload
  });
};

export const signOut: RequestHandler = async (req, res) => {
  const accessToken = getBearerToken(req.headers.authorization);
  await authModel.signOutAuthSession(accessToken);

  res.status(200).json({
    success: true
  });
};

export const getMe: RequestHandler = async (req, res) => {
  const accessToken = getBearerToken(req.headers.authorization);
  const user = await authModel.getCurrentUser(accessToken);

  res.status(200).json({
    success: true,
    data: user
  });
};

export const startGoogleSignIn: RequestHandler = async (_req, res) => {
  const authPayload = await authModel.getGoogleSignInUrl();

  res.status(200).json({
    success: true,
    data: authPayload
  });
};

export const handleGoogleCallback: RequestHandler = async (req, res) => {
  if (typeof req.query.error === "string" && req.query.error.trim().length > 0) {
    res.redirect(
      302,
      authModel.buildAuthErrorRedirectUrl(
        "oauth_provider_error",
        typeof req.query.error_description === "string" &&
          req.query.error_description.trim().length > 0
          ? req.query.error_description
          : req.query.error
      )
    );
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;

  if (!code || !state) {
    res.redirect(
      302,
      authModel.buildAuthErrorRedirectUrl(
        "invalid_oauth_callback",
        "Google callback requires both code and state"
      )
    );
    return;
  }

  try {
    const authPayload = await authModel.exchangeGoogleAuthCode({
      code,
      state
    });

    res.redirect(302, authModel.buildAuthSuccessRedirectUrl(authPayload));
  } catch (error) {
    res.redirect(
      302,
      authModel.buildAuthErrorRedirectUrl(
        error instanceof HttpError && error.statusCode === 401
          ? "invalid_oauth_state"
          : "oauth_exchange_failed",
        getErrorMessage(error)
      )
    );
  }
};
