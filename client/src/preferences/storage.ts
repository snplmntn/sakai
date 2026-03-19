import * as SecureStore from 'expo-secure-store';

import {
  parsePreferenceDraft,
  parseStoredPreferences,
  type PreferenceDraft,
  type StoredPreferences,
} from './types';

const PREFERENCES_STORAGE_KEY = 'sakai.user.preferences';
const ONBOARDING_PREFERENCE_KEY = 'sakai.onboarding.preferences';

const readStoredJson = async <T>(
  key: string,
  parser: (value: unknown) => T
): Promise<T | null> => {
  const storedValue = await SecureStore.getItemAsync(key);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;
    return parser(parsedValue);
  } catch {
    await SecureStore.deleteItemAsync(key);
    return null;
  }
};

export const readStoredPreferences = async (): Promise<StoredPreferences | null> =>
  readStoredJson(PREFERENCES_STORAGE_KEY, parseStoredPreferences);

export const writeStoredPreferences = async (value: StoredPreferences): Promise<void> => {
  await SecureStore.setItemAsync(PREFERENCES_STORAGE_KEY, JSON.stringify(value));
};

export const clearStoredPreferences = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PREFERENCES_STORAGE_KEY);
};

export const readStoredPreferenceDraft = async (): Promise<PreferenceDraft | null> =>
  readStoredJson(ONBOARDING_PREFERENCE_KEY, parsePreferenceDraft);

export const writeStoredPreferenceDraft = async (value: PreferenceDraft): Promise<void> => {
  await SecureStore.setItemAsync(ONBOARDING_PREFERENCE_KEY, JSON.stringify(value));
};

export const clearStoredPreferenceDraft = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ONBOARDING_PREFERENCE_KEY);
};
