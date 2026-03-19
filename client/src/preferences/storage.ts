import * as SecureStore from 'expo-secure-store';

import {
  parseStoredPreferences,
  type StoredPreferences,
} from './types';

const PREFERENCES_STORAGE_KEY = 'sakai.user.preferences';

export const readStoredPreferences = async (): Promise<StoredPreferences | null> => {
  const storedValue = await SecureStore.getItemAsync(PREFERENCES_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;
    return parseStoredPreferences(parsedValue);
  } catch {
    await SecureStore.deleteItemAsync(PREFERENCES_STORAGE_KEY);
    return null;
  }
};

export const writeStoredPreferences = async (value: StoredPreferences): Promise<void> => {
  await SecureStore.setItemAsync(PREFERENCES_STORAGE_KEY, JSON.stringify(value));
};

export const clearStoredPreferences = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PREFERENCES_STORAGE_KEY);
};
