import {
  parseGoogleAuthUrlPayload,
  parseAuthPayload,
  parseAuthUser,
  type AuthPayload,
  type AuthUser,
  type GoogleAuthUrlPayload,
} from './types';
import { ApiError, requestData, requestWithoutData } from '../api/base';

interface EmailPasswordCredentials {
  email: string;
  password: string;
}

interface RefreshSessionInput {
  refreshToken: string;
}
export const signUp = async (
  credentials: EmailPasswordCredentials
): Promise<AuthPayload> =>
  requestData(
    {
      method: 'POST',
      path: '/api/auth/sign-up',
      body: credentials,
    },
    parseAuthPayload
  );

export const signIn = async (
  credentials: EmailPasswordCredentials
): Promise<AuthPayload> =>
  requestData(
    {
      method: 'POST',
      path: '/api/auth/sign-in',
      body: credentials,
    },
    parseAuthPayload
  );

export const refreshSession = async (
  input: RefreshSessionInput
): Promise<AuthPayload> =>
  requestData(
    {
      method: 'POST',
      path: '/api/auth/refresh',
      body: input,
    },
    parseAuthPayload
  );

export const getGoogleAuthUrl = async (
  appRedirectUri: string
): Promise<GoogleAuthUrlPayload> =>
  requestData(
    {
      method: 'GET',
      path: `/api/auth/google/start?appRedirectUri=${encodeURIComponent(appRedirectUri)}`,
    },
    parseGoogleAuthUrlPayload
  );

export const getMe = async (accessToken: string): Promise<AuthUser> =>
  requestData(
    {
      method: 'GET',
      path: '/api/auth/me',
      accessToken,
    },
    parseAuthUser
  );

export const signOut = async (accessToken: string): Promise<void> =>
  requestWithoutData({
    method: 'POST',
    path: '/api/auth/sign-out',
    accessToken,
  });

export { ApiError };
