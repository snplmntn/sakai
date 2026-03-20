export type AuthMetadata = Record<string, unknown> | null;

export interface AuthUser {
  id: string;
  email: string | null;
  appMetadata: AuthMetadata;
  userMetadata: AuthMetadata;
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

export type GoogleAuthOrigin = 'login' | 'signup';

export interface GoogleAuthCallbackSuccess {
  status: 'success';
  userId: string;
  email: string | null;
  session: AuthSession;
}

export interface GoogleAuthCallbackError {
  status: 'error';
  errorCode: string;
  message: string;
}

export type GoogleAuthCallbackResult =
  | GoogleAuthCallbackSuccess
  | GoogleAuthCallbackError;

export type AuthStatus = 'hydrating' | 'authenticated' | 'unauthenticated';

export interface StoredAuthState {
  user: AuthUser;
  session: AuthSession;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string`);
  }

  return value;
};

const readNullableString = (value: unknown, fieldName: string): string | null => {
  if (value === null) {
    return null;
  }

  return readString(value, fieldName);
};

const readNumber = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected ${fieldName} to be a number`);
  }

  return value;
};

const readNullableNumber = (value: unknown, fieldName: string): number | null => {
  if (value === null) {
    return null;
  }

  return readNumber(value, fieldName);
};

const readBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${fieldName} to be a boolean`);
  }

  return value;
};

const readMetadata = (value: unknown): AuthMetadata => {
  if (value === null || value === undefined) {
    return null;
  }

  return isRecord(value) ? value : null;
};

const readUrlSearchParam = (value: string | null, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string`);
  }

  return value;
};

const readOptionalUrlSearchParam = (value: string | null): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const readUrlSearchParamNumber = (value: string | null, fieldName: string): number => {
  const parsedValue = Number(readUrlSearchParam(value, fieldName));

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Expected ${fieldName} to be a number`);
  }

  return parsedValue;
};

const readOptionalUrlSearchParamNumber = (
  value: string | null,
  fieldName: string
): number | null => {
  if (value === null) {
    return null;
  }

  return readUrlSearchParamNumber(value, fieldName);
};

export const parseAuthUser = (value: unknown): AuthUser => {
  if (!isRecord(value)) {
    throw new Error('Expected auth user to be an object');
  }

  return {
    id: readString(value.id, 'user.id'),
    email: readNullableString(value.email ?? null, 'user.email'),
    appMetadata: readMetadata(value.appMetadata),
    userMetadata: readMetadata(value.userMetadata),
  };
};

export const parseAuthSession = (value: unknown): AuthSession => {
  if (!isRecord(value)) {
    throw new Error('Expected auth session to be an object');
  }

  return {
    accessToken: readString(value.accessToken, 'session.accessToken'),
    refreshToken: readString(value.refreshToken, 'session.refreshToken'),
    expiresIn: readNumber(value.expiresIn, 'session.expiresIn'),
    expiresAt: readNullableNumber(value.expiresAt ?? null, 'session.expiresAt'),
    tokenType: readString(value.tokenType, 'session.tokenType'),
  };
};

export const parseAuthPayload = (value: unknown): AuthPayload => {
  if (!isRecord(value)) {
    throw new Error('Expected auth payload to be an object');
  }

  const userValue = value.user ?? null;
  const sessionValue = value.session ?? null;

  return {
    user: userValue === null ? null : parseAuthUser(userValue),
    session: sessionValue === null ? null : parseAuthSession(sessionValue),
    requiresEmailConfirmation: readBoolean(
      value.requiresEmailConfirmation,
      'requiresEmailConfirmation'
    ),
  };
};

export const parseGoogleAuthCallbackResult = (
  callbackUrl: string
): GoogleAuthCallbackResult => {
  const parsedUrl = new URL(callbackUrl);
  const fragment = parsedUrl.hash.startsWith('#')
    ? parsedUrl.hash.slice(1)
    : parsedUrl.hash;
  const params = new URLSearchParams(fragment);
  const status = readUrlSearchParam(params.get('status'), 'status');

  if (status === 'success') {
    return {
      status: 'success',
      userId: readUrlSearchParam(params.get('user_id'), 'user_id'),
      email: readOptionalUrlSearchParam(params.get('email')),
      session: {
        accessToken: readUrlSearchParam(params.get('access_token'), 'access_token'),
        refreshToken: readUrlSearchParam(params.get('refresh_token'), 'refresh_token'),
        expiresIn: readUrlSearchParamNumber(params.get('expires_in'), 'expires_in'),
        expiresAt: readOptionalUrlSearchParamNumber(params.get('expires_at'), 'expires_at'),
        tokenType: readUrlSearchParam(params.get('token_type'), 'token_type'),
      },
    };
  }

  if (status === 'error') {
    return {
      status: 'error',
      errorCode: readUrlSearchParam(params.get('error'), 'error'),
      message: readUrlSearchParam(params.get('message'), 'message'),
    };
  }

  throw new Error('Unknown Google auth callback status');
};

export const parseStoredAuthState = (value: unknown): StoredAuthState => {
  if (!isRecord(value)) {
    throw new Error('Expected stored auth state to be an object');
  }

  return {
    user: parseAuthUser(value.user),
    session: parseAuthSession(value.session),
  };
};

export const hasAuthenticatedSession = (
  value: AuthPayload
): value is AuthPayload & { user: AuthUser; session: AuthSession } =>
  value.user !== null && value.session !== null;
