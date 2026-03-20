import { getExpoGoProjectConfig } from 'expo';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  accessToken?: string;
  body?: unknown;
  timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 30000;
const NETWORK_ERROR_STATUS_CODE = 0;
const LOOPBACK_API_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);
const REQUEST_TIMEOUT_MESSAGE =
  'The Sakai server took too long to respond. Please try again.';
const REQUEST_NETWORK_ERROR_MESSAGE =
  'Unable to reach the Sakai server. Check your connection and API base URL.';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details: unknown;

  constructor(statusCode: number, message: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readConfiguredApiBaseUrl = (): string => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_BASE_URL. Set it to the Sakai server base URL.'
    );
  }

  return baseUrl.replace(/\/+$/, '');
};

const readExpoGoHostName = (): string | null => {
  const debuggerHost = getExpoGoProjectConfig()?.debuggerHost;

  if (typeof debuggerHost !== 'string' || debuggerHost.trim().length === 0) {
    return null;
  }

  const [hostName] = debuggerHost.trim().split(':');
  return typeof hostName === 'string' && hostName.trim().length > 0
    ? hostName.trim()
    : null;
};

const resolveDevelopmentApiBaseUrl = (configuredBaseUrl: string): string => {
  if (!__DEV__) {
    return configuredBaseUrl;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(configuredBaseUrl);
  } catch {
    return configuredBaseUrl;
  }

  if (!LOOPBACK_API_HOSTS.has(parsedUrl.hostname)) {
    return configuredBaseUrl;
  }

  const expoGoHostName = readExpoGoHostName();

  if (
    expoGoHostName === null ||
    LOOPBACK_API_HOSTS.has(expoGoHostName) ||
    expoGoHostName === parsedUrl.hostname
  ) {
    return configuredBaseUrl;
  }

  // Expo Go often runs on a separate device, so loopback URLs need the dev machine host.
  parsedUrl.hostname = expoGoHostName;
  return parsedUrl.toString().replace(/\/+$/, '');
};

export const readApiBaseUrl = (): string =>
  resolveDevelopmentApiBaseUrl(readConfiguredApiBaseUrl());

export const buildApiUrl = (path: string): string => `${readApiBaseUrl()}${path}`;

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

const redactSensitiveData = (data: unknown): unknown => {
  if (!isRecord(data)) {
    return data;
  }

  const redacted = { ...data };
  if ('password' in redacted) {
    redacted.password = '[REDACTED]';
  }
  return redacted;
};

const performRequest = async (
  options: RequestOptions,
  headers: Record<string, string>
): Promise<Response> => {
  const url = buildApiUrl(options.path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  console.log(`[API Request] ${options.method} ${url}`, {
    body: redactSensitiveData(options.body),
    headers,
  });

  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    console.error(`[API Network Error] ${options.method} ${url}`, error);
    throw new ApiError(
      NETWORK_ERROR_STATUS_CODE,
      isAbortError(error) ? REQUEST_TIMEOUT_MESSAGE : REQUEST_NETWORK_ERROR_MESSAGE
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

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

export const requestData = async <T>(
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

  const response = await performRequest(options, headers);
  const responseBody = await parseJsonBody(response);

  console.log(`[API Response] ${response.status} ${options.path}`, responseBody);

  if (!response.ok) {
    const details = isRecord(responseBody) ? (responseBody.details ?? null) : null;

    throw new ApiError(
      response.status,
      getApiErrorMessage(responseBody, 'Request failed'),
      details
    );
  }

  return parser(parseSuccessEnvelopeData(responseBody));
};

export const requestWithoutData = async (options: RequestOptions): Promise<void> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await performRequest(options, headers);
  const responseBody = await parseJsonBody(response);

  console.log(`[API Response] ${response.status} ${options.path}`, responseBody);

  if (!response.ok) {
    const details = isRecord(responseBody) ? (responseBody.details ?? null) : null;

    throw new ApiError(
      response.status,
      getApiErrorMessage(responseBody, 'Request failed'),
      details
    );
  }

  if (responseBody !== null && (!isRecord(responseBody) || responseBody.success !== true)) {
    throw new Error('Unexpected API response from the Sakai server');
  }
};
