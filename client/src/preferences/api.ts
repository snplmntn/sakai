import { requestData } from '../api/base';

import {
  parseUserPreferences,
  type PreferenceDraft,
  type UserPreferences,
} from './types';

const requestPreferences = async (
  accessToken: string,
  method: 'GET' | 'PUT',
  body?: PreferenceDraft
): Promise<UserPreferences> =>
  requestData(
    {
      method,
      path: '/api/me/preferences',
      accessToken,
      body,
    },
    parseUserPreferences
  );

export const getUserPreferences = async (
  accessToken: string
): Promise<UserPreferences> => requestPreferences(accessToken, 'GET');

export const updateUserPreferences = async (
  accessToken: string,
  input: PreferenceDraft
): Promise<UserPreferences> => requestPreferences(accessToken, 'PUT', input);

export const getMyPreferences = async (accessToken: string): Promise<UserPreferences> =>
  getUserPreferences(accessToken);

export const upsertMyPreferences = async (
  accessToken: string,
  draft: PreferenceDraft
): Promise<UserPreferences> => updateUserPreferences(accessToken, draft);
