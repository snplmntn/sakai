import { requestData } from '../api/base';

import {
  parseUserPreferences,
  type PreferenceDraft,
  type UserPreferences,
} from './types';

export type PersistedPreferenceDraft = Pick<
  PreferenceDraft,
  'defaultPreference' | 'passengerType'
>;

export const toPersistedPreferenceDraft = (
  value: Pick<PreferenceDraft, 'defaultPreference' | 'passengerType'>
): PersistedPreferenceDraft => ({
  defaultPreference: value.defaultPreference,
  passengerType: value.passengerType,
});

const requestPreferences = async (
  accessToken: string,
  method: 'GET' | 'PUT',
  body?: PersistedPreferenceDraft
): Promise<UserPreferences> =>
  requestData(
    {
      method,
      path: '/api/me/preferences',
      accessToken,
      body: body ? toPersistedPreferenceDraft(body) : undefined,
    },
    parseUserPreferences
  );

export const getUserPreferences = async (
  accessToken: string
): Promise<UserPreferences> => requestPreferences(accessToken, 'GET');

export const updateUserPreferences = async (
  accessToken: string,
  input: PersistedPreferenceDraft
): Promise<UserPreferences> => requestPreferences(accessToken, 'PUT', input);

export const getMyPreferences = async (accessToken: string): Promise<UserPreferences> =>
  getUserPreferences(accessToken);

export const upsertMyPreferences = async (
  accessToken: string,
  draft: PersistedPreferenceDraft
): Promise<UserPreferences> => updateUserPreferences(accessToken, draft);
