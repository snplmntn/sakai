import { requestData } from '../api/base';

import {
  parseUserPreferences,
  type UserPreferences,
} from './types';

export const getUserPreferences = async (
  accessToken: string
): Promise<UserPreferences> =>
  requestData(
    {
      method: 'GET',
      path: '/api/me/preferences',
      accessToken,
    },
    parseUserPreferences
  );

export const updateUserPreferences = async (
  accessToken: string,
  input: {
    defaultPreference: UserPreferences['defaultPreference'];
    passengerType: UserPreferences['passengerType'];
  }
): Promise<UserPreferences> =>
  requestData(
    {
      method: 'PUT',
      path: '/api/me/preferences',
      accessToken,
      body: input,
    },
    parseUserPreferences
  );
