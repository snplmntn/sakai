import { parseUserPreferences, type PreferenceDraft, type UserPreferences } from './types';

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

const readErrorMessage = (body: unknown, fallbackMessage: string): string => {
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (isRecord(body) && typeof body.message === 'string' && body.message.trim().length > 0) {
    return body.message;
  }

  return fallbackMessage;
};

const parseSuccessEnvelope = (body: unknown): unknown => {
  if (!isRecord(body) || body.success !== true) {
    throw new Error('Unexpected API response from the Sakai server');
  }

  return body.data;
};

const requestPreferences = async (
  accessToken: string,
  method: 'GET' | 'PUT',
  body?: PreferenceDraft
): Promise<UserPreferences> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildApiUrl('/api/me/preferences'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(responseBody, 'Failed to sync preferences'));
  }

  return parseUserPreferences(parseSuccessEnvelope(responseBody));
};

export const getMyPreferences = async (accessToken: string): Promise<UserPreferences> =>
  requestPreferences(accessToken, 'GET');

export const upsertMyPreferences = async (
  accessToken: string,
  draft: PreferenceDraft
): Promise<UserPreferences> => requestPreferences(accessToken, 'PUT', draft);
