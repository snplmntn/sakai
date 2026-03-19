import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

import type { Session, User } from "@supabase/supabase-js";

import { getEnv } from "../config/env.js";
import { createSupabaseAuthClient, getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";

const AUTH_STATE_TTL_SECONDS = 10 * 60;

interface SignedAuthStatePayload {
  codeVerifier: string;
  iat: number;
  exp: number;
}

interface SupabasePkceTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: User | null;
}

export interface AuthUser {
  id: string;
  email: string | null;
  appMetadata: User["app_metadata"];
  userMetadata: User["user_metadata"];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number | null;
  tokenType: string;
}

export interface AuthPayload {
  user: AuthUser | null;
  session: AuthSession | null;
  requiresEmailConfirmation: boolean;
}

export interface GoogleAuthUrlPayload {
  url: string;
}

export interface ExchangeGoogleAuthCodeOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
}

export interface SignedAuthStateOptions {
  now?: Date;
  ttlSeconds?: number;
}

const getAuthErrorStatusCode = (error: unknown, fallbackStatusCode: number) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  ) {
    if (
      error.status === 400 &&
      "message" in error &&
      typeof error.message === "string" &&
      /invalid login credentials/i.test(error.message)
    ) {
      return 401;
    }

    return error.status;
  }

  return fallbackStatusCode;
};

const toAuthHttpError = (
  error: unknown,
  fallbackStatusCode: number,
  fallbackMessage: string
) => {
  const statusCode = getAuthErrorStatusCode(error, fallbackStatusCode);
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallbackMessage;

  return new HttpError(statusCode, message);
};

const getUnixTimestamp = (date = new Date()) => Math.floor(date.getTime() / 1000);

const createSigningDigest = (value: string): Buffer =>
  createHmac("sha256", getEnv().AUTH_STATE_SIGNING_SECRET).update(value).digest();

const createPkceCodeVerifier = () => randomBytes(32).toString("base64url");

const createPkceCodeChallenge = (codeVerifier: string) =>
  createHash("sha256").update(codeVerifier).digest("base64url");

const buildSupabaseUrl = (path: string) => new URL(path, getEnv().SUPABASE_URL).toString();

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
};

const getResponseMessage = (body: unknown, fallbackMessage: string): string => {
  if (typeof body === "string" && body.trim().length > 0) {
    return body;
  }

  if (typeof body === "object" && body !== null) {
    if ("msg" in body && typeof body.msg === "string" && body.msg.trim().length > 0) {
      return body.msg;
    }

    if (
      "message" in body &&
      typeof body.message === "string" &&
      body.message.trim().length > 0
    ) {
      return body.message;
    }

    if (
      "error_description" in body &&
      typeof body.error_description === "string" &&
      body.error_description.trim().length > 0
    ) {
      return body.error_description;
    }

    if ("error" in body && typeof body.error === "string" && body.error.trim().length > 0) {
      return body.error;
    }
  }

  return fallbackMessage;
};

const getInvalidAuthStateError = (message = "Invalid OAuth state") =>
  new HttpError(401, message);

export const createSignedAuthState = (
  codeVerifier: string,
  options: SignedAuthStateOptions = {}
): string => {
  const issuedAt = getUnixTimestamp(options.now);
  const expiresAt = issuedAt + (options.ttlSeconds ?? AUTH_STATE_TTL_SECONDS);
  const payload: SignedAuthStatePayload = {
    codeVerifier,
    iat: issuedAt,
    exp: expiresAt
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createSigningDigest(encodedPayload).toString("base64url");

  return `${encodedPayload}.${signature}`;
};

export const verifySignedAuthState = (
  state: string,
  options: SignedAuthStateOptions = {}
): SignedAuthStatePayload => {
  const [encodedPayload, encodedSignature] = state.split(".");

  if (!encodedPayload || !encodedSignature) {
    throw getInvalidAuthStateError();
  }

  let actualSignature: Buffer;

  try {
    actualSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw getInvalidAuthStateError();
  }

  const expectedSignature = createSigningDigest(encodedPayload);

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw getInvalidAuthStateError();
  }

  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
  } catch {
    throw getInvalidAuthStateError();
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("codeVerifier" in payload) ||
    typeof payload.codeVerifier !== "string" ||
    payload.codeVerifier.length < 43 ||
    !("exp" in payload) ||
    typeof payload.exp !== "number" ||
    !("iat" in payload) ||
    typeof payload.iat !== "number"
  ) {
    throw getInvalidAuthStateError();
  }

  if (payload.exp <= getUnixTimestamp(options.now)) {
    throw getInvalidAuthStateError("OAuth state has expired");
  }

  return payload as SignedAuthStatePayload;
};

const mapAuthUser = (user: User): AuthUser => ({
  id: user.id,
  email: user.email ?? null,
  appMetadata: user.app_metadata,
  userMetadata: user.user_metadata
});

const mapAuthSession = (session: Session): AuthSession => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresIn: session.expires_in,
  expiresAt: session.expires_at ?? null,
  tokenType: session.token_type
});

const mapAuthSessionFromPkceTokenResponse = (
  response: SupabasePkceTokenResponse
): AuthSession => ({
  accessToken: response.access_token,
  refreshToken: response.refresh_token,
  expiresIn: response.expires_in,
  expiresAt: response.expires_at ?? null,
  tokenType: response.token_type
});

const buildAuthPayload = (options: {
  user: User | null;
  session: Session | null;
  requiresEmailConfirmation?: boolean;
}): AuthPayload => ({
  user: options.user ? mapAuthUser(options.user) : null,
  session: options.session ? mapAuthSession(options.session) : null,
  requiresEmailConfirmation: options.requiresEmailConfirmation ?? false
});

export const signUpWithEmailAndPassword = async (payload: {
  email: string;
  password: string;
}): Promise<AuthPayload> => {
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.signUp({
    email: payload.email,
    password: payload.password
  });

  if (error) {
    throw toAuthHttpError(error, 400, "Failed to sign up");
  }

  if (!data.user) {
    throw new HttpError(500, "Supabase did not return a user for sign up");
  }

  return buildAuthPayload({
    user: data.user,
    session: data.session,
    requiresEmailConfirmation: data.session === null
  });
};

export const signInWithEmailAndPassword = async (payload: {
  email: string;
  password: string;
}): Promise<AuthPayload> => {
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  });

  if (error) {
    throw toAuthHttpError(error, 401, "Failed to sign in");
  }

  if (!data.user || !data.session) {
    throw new HttpError(500, "Supabase did not return a session for sign in");
  }

  return buildAuthPayload({
    user: data.user,
    session: data.session
  });
};

export const refreshAuthSession = async (payload: {
  refreshToken: string;
}): Promise<AuthPayload> => {
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.refreshSession({
    refresh_token: payload.refreshToken
  });

  if (error) {
    throw toAuthHttpError(error, 401, "Failed to refresh session");
  }

  if (!data.user || !data.session) {
    throw new HttpError(500, "Supabase did not return a refreshed session");
  }

  return buildAuthPayload({
    user: data.user,
    session: data.session
  });
};

export const signOutAuthSession = async (accessToken: string): Promise<void> => {
  const client = getSupabaseAdminClient();
  const { error } = await client.auth.admin.signOut(accessToken, "local");

  if (error) {
    throw toAuthHttpError(error, 401, "Failed to sign out");
  }
};

export const getCurrentUser = async (accessToken: string): Promise<AuthUser> => {
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error) {
    throw toAuthHttpError(error, 401, "Failed to fetch current user");
  }

  if (!data.user) {
    throw new HttpError(401, "No authenticated user found for the access token");
  }

  return mapAuthUser(data.user);
};

export const getGoogleSignInUrl = async (
  options: SignedAuthStateOptions = {}
): Promise<GoogleAuthUrlPayload> => {
  const env = getEnv();
  const codeVerifier = createPkceCodeVerifier();
  const state = createSignedAuthState(codeVerifier, options);
  const url = new URL(buildSupabaseUrl("/auth/v1/authorize"));

  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", env.AUTH_GOOGLE_REDIRECT_URI);
  url.searchParams.set("code_challenge", createPkceCodeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("state", state);
  url.searchParams.set("skip_http_redirect", "true");

  return { url: url.toString() };
};

export const exchangeGoogleAuthCode = async (
  payload: {
    code: string;
    state: string;
  },
  options: ExchangeGoogleAuthCodeOptions = {}
): Promise<AuthPayload> => {
  const env = getEnv();
  const fetchImpl = options.fetchImpl ?? fetch;
  const signedState = verifySignedAuthState(payload.state, {
    now: options.now
  });
  const response = await fetchImpl(buildSupabaseUrl("/auth/v1/token?grant_type=pkce"), {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      auth_code: payload.code,
      code_verifier: signedState.codeVerifier
    })
  });
  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    throw new HttpError(
      response.status >= 500 ? 502 : 401,
      getResponseMessage(responseBody, "Failed to exchange Google auth code")
    );
  }

  const tokenResponse = responseBody as Partial<SupabasePkceTokenResponse>;

  if (
    !tokenResponse.user ||
    typeof tokenResponse.access_token !== "string" ||
    typeof tokenResponse.refresh_token !== "string" ||
    typeof tokenResponse.expires_in !== "number" ||
    typeof tokenResponse.token_type !== "string"
  ) {
    throw new HttpError(500, "Supabase did not return a session for Google sign in");
  }

  return {
    user: mapAuthUser(tokenResponse.user as User),
    session: mapAuthSessionFromPkceTokenResponse(
      tokenResponse as SupabasePkceTokenResponse
    ),
    requiresEmailConfirmation: false
  };
};

const buildAppRedirectUrl = (params: Record<string, string>) => {
  const redirectUrl = new URL(getEnv().AUTH_APP_REDIRECT_URI);

  redirectUrl.hash = new URLSearchParams(params).toString();

  return redirectUrl.toString();
};

export const buildAuthSuccessRedirectUrl = (payload: AuthPayload): string => {
  if (!payload.user || !payload.session) {
    throw new HttpError(500, "Cannot build auth redirect without a user session");
  }

  const fragmentParams: Record<string, string> = {
    status: "success",
    access_token: payload.session.accessToken,
    refresh_token: payload.session.refreshToken,
    expires_in: String(payload.session.expiresIn),
    token_type: payload.session.tokenType,
    user_id: payload.user.id
  };

  if (payload.session.expiresAt !== null) {
    fragmentParams.expires_at = String(payload.session.expiresAt);
  }

  if (payload.user.email) {
    fragmentParams.email = payload.user.email;
  }

  return buildAppRedirectUrl(fragmentParams);
};

export const buildAuthErrorRedirectUrl = (
  errorCode: string,
  message: string
): string =>
  buildAppRedirectUrl({
    status: "error",
    error: errorCode,
    message
  });
