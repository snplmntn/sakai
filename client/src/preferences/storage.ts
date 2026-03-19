import * as SecureStore from 'expo-secure-store';

import { parsePreferenceDraft, type PreferenceDraft } from './types';

const ONBOARDING_PREFERENCE_KEY = 'sakai.onboarding.preferences';

export const readStoredPreferenceDraft = async (): Promise<PreferenceDraft | null> => {
  const storedValue = await SecureStore.getItemAsync(ONBOARDING_PREFERENCE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;
    return parsePreferenceDraft(parsedValue);
  } catch {
    await SecureStore.deleteItemAsync(ONBOARDING_PREFERENCE_KEY);
    return null;
  }
};

export const writeStoredPreferenceDraft = async (value: PreferenceDraft): Promise<void> => {
  await SecureStore.setItemAsync(ONBOARDING_PREFERENCE_KEY, JSON.stringify(value));
};

export const clearStoredPreferenceDraft = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ONBOARDING_PREFERENCE_KEY);
};
