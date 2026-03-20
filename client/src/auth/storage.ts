import * as SecureStore from 'expo-secure-store';

import { parseStoredAuthState, type StoredAuthState } from './types';

const AUTH_STORAGE_KEY = 'sakai.auth.session';
const ONBOARDING_COMPLETED_STORAGE_KEY = 'sakai.auth.onboarding.completed';

export const readStoredAuthState = async (): Promise<StoredAuthState | null> => {
  const storedValue = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;
    return parseStoredAuthState(parsedValue);
  } catch {
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
    return null;
  }
};

export const writeStoredAuthState = async (value: StoredAuthState): Promise<void> => {
  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(value));
};

export const clearStoredAuthState = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
};

export const readHasCompletedOnboarding = async (): Promise<boolean> => {
  const storedValue = await SecureStore.getItemAsync(ONBOARDING_COMPLETED_STORAGE_KEY);

  return storedValue === 'true';
};

export const writeHasCompletedOnboarding = async (): Promise<void> => {
  await SecureStore.setItemAsync(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
};
