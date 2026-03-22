import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

const readRequiredEnv = (value: string | undefined, envName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing ${envName}. Set it in the Expo app environment.`);
  }

  return value.trim();
};

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

WebBrowser.maybeCompleteAuthSession();

export const supabase = createClient(
  readRequiredEnv(process.env.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL'),
  readRequiredEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      storage: secureStoreAdapter,
    },
  }
);
