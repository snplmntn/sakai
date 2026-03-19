import {
  parseAuthPayload,
  parseAuthUser,
  type AuthPayload,
  type AuthUser,
} from './types';

interface EmailPasswordCredentials {
  email: string;
  password: string;
}

interface RefreshSessionInput {
  refreshToken: string;
}

type HttpMethod = 'GET' | 'POST';

interface RequestOptions {
  method: HttpMethod;
  path: string;
  accessToken?: string;
  body?: unknown;
}

class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readApiBaseUrl = (): string => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_BASE_URL. Set it to the Sakai server base URL.'
    );
  }

  return baseUrl.replace(/\/+$/, '');
};

const buildApiUrl = (path: string): string => `${readApiBaseUrl()}${path}`;

const parseJsonBody = async (response: Response): Promise<unknown> => {
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

const getApiErrorMessage = (body: unknown, fallbackMessage: string): string => {
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (isRecord(body) && typeof body.message === 'string' && body.message.trim().length > 0) {
    return body.message;
  }

  return fallbackMessage;
};

const parseSuccessEnvelopeData = (body: unknown): unknown => {
  if (!isRecord(body) || body.success !== true) {
    throw new Error('Unexpected API response from the Sakai server');
  }

  return body.data;
};

const requestData = async <T>(
  options: RequestOptions,
  parser: (value: unknown) => T
): Promise<T> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(buildApiUrl(options.path), {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const responseBody = await parseJsonBody(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      getApiErrorMessage(responseBody, 'Request failed')
    );
  }

  return parser(parseSuccessEnvelopeData(responseBody));
};

const requestWithoutData = async (options: RequestOptions): Promise<void> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(buildApiUrl(options.path), {
    method: options.method,
    headers,
  });
  const responseBody = await parseJsonBody(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      getApiErrorMessage(responseBody, 'Request failed')
    );
  }

  if (responseBody !== null && (!isRecord(responseBody) || responseBody.success !== true)) {
    throw new Error('Unexpected API response from the Sakai server');
  }
};

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
