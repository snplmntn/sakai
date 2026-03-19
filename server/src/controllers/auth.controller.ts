import type { Request, RequestHandler } from "express";

import * as authModel from "../models/auth.model.js";
import { getAuthenticatedLocals } from "../middlewares/auth.middleware.js";
import { HttpError } from "../types/http-error.js";

const getErrorMessage = (error: unknown) => {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Authentication failed";
};

const getRequestOrigin = (req: Request): string => {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol =
    forwardedProto && forwardedProto.length > 0
      ? forwardedProto
      : req.protocol && req.protocol.trim().length > 0
        ? req.protocol
        : "http";
  const directHost = req.get("host");
  const host =
    forwardedHost && forwardedHost.length > 0
      ? forwardedHost
      : directHost && directHost.trim().length > 0
        ? directHost
        : req.hostname && req.hostname.trim().length > 0
          ? req.hostname
          : "localhost";

  return `${protocol}://${host}`;
};

const getGoogleCallbackUrl = (req: Request): string => {
  const callbackUrl = new URL("/api/auth/google/callback", getRequestOrigin(req));
  return callbackUrl.toString();
};

export const signUp: RequestHandler = async (req, res) => {
  console.log(`[Server Auth] signUp request received for ${req.body.email}`);
  const authPayload = await authModel.signUpWithEmailAndPassword(req.body);

  res.status(201).json({
    success: true,
    data: authPayload
  });
};

export const signIn: RequestHandler = async (req, res) => {
  console.log(`[Server Auth] signIn request received for ${req.body.email}`);
  try {
    const authPayload = await authModel.signInWithEmailAndPassword(req.body);
    console.log(`[Server Auth] signIn successful for ${req.body.email}`);

    res.status(200).json({
      success: true,
      data: authPayload
    });
  } catch (error) {
    console.error(`[Server Auth] signIn error for ${req.body.email}:`, error);
    throw error;
  }
};

export const refreshSession: RequestHandler = async (req, res) => {
  const authPayload = await authModel.refreshAuthSession(req.body);

  res.status(200).json({
    success: true,
    data: authPayload
  });
};

export const signOut: RequestHandler = async (req, res) => {
  const { accessToken } = getAuthenticatedLocals(res);
  await authModel.signOutAuthSession(accessToken);

  res.status(200).json({
    success: true
  });
};

export const getMe: RequestHandler = async (req, res) => {
  const { user } = getAuthenticatedLocals(res);

  res.status(200).json({
    success: true,
    data: user
  });
};

export const startGoogleSignIn: RequestHandler = async (req, res) => {
  const authPayload = await authModel.getGoogleSignInUrl({
    callbackUrl: getGoogleCallbackUrl(req),
    appRedirectUri:
      typeof req.query.appRedirectUri === "string" ? req.query.appRedirectUri : undefined
  });

  res.status(200).json({
    success: true,
    data: authPayload
  });
};

export const handleGoogleCallback: RequestHandler = async (req, res) => {
  const defaultAppRedirectUri = authModel.getDefaultAppRedirectUri();

  if (typeof req.query.error === "string" && req.query.error.trim().length > 0) {
    res.redirect(
      302,
      authModel.buildAuthErrorRedirectUrl(
        "oauth_provider_error",
        typeof req.query.error_description === "string" &&
          req.query.error_description.trim().length > 0
          ? req.query.error_description
          : req.query.error,
        defaultAppRedirectUri
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
        "Google callback requires both code and state",
        defaultAppRedirectUri
      )
    );
    return;
  }

  let appRedirectUri = defaultAppRedirectUri;

  try {
    appRedirectUri = authModel.verifySignedAuthState(state).appRedirectUri;
    const authPayload = await authModel.exchangeGoogleAuthCode({
      code,
      state
    });

    res.redirect(302, authModel.buildAuthSuccessRedirectUrl(authPayload, appRedirectUri));
  } catch (error) {
    res.redirect(
      302,
      authModel.buildAuthErrorRedirectUrl(
        error instanceof HttpError && error.statusCode === 401
          ? "invalid_oauth_state"
          : "oauth_exchange_failed",
        getErrorMessage(error),
        appRedirectUri
      )
    );
  }
};
