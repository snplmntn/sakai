export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  accessToken?: string;
  body?: unknown;
}

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

export const readApiBaseUrl = (): string => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_BASE_URL. Set it to the Sakai server base URL.'
    );
  }

  return baseUrl.replace(/\/+$/, '');
};

export const buildApiUrl = (path: string): string => `${readApiBaseUrl()}${path}`;

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

  const response = await fetch(buildApiUrl(options.path), {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const responseBody = await parseJsonBody(response);

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

  const response = await fetch(buildApiUrl(options.path), {
    method: options.method,
    headers,
  });
  const responseBody = await parseJsonBody(response);

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
