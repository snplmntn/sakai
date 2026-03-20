import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '../api/base';
import { useAuth } from '../auth/AuthContext';
import {
  getUserPreferences,
  updateUserPreferences,
} from './api';
import {
  readStoredPreferences,
  writeStoredPreferences,
} from './storage';
import {
  createDefaultUserPreferences,
  toStoredPreferences,
  toUserPreferencesFromStored,
  type UserPreferences,
} from './types';

interface PreferencesContextValue {
  preferences: UserPreferences;
  status: 'loading' | 'ready';
  isUpdating: boolean;
  updatePreferences: (
    input: Pick<
      UserPreferences,
      'defaultPreference' | 'passengerType' | 'routeModifiers' | 'voiceLanguage'
    >
  ) => Promise<UserPreferences>;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const PREFERENCES_FETCH_ERROR = 'Unable to load your commute preferences right now.';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, session } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(createDefaultUserPreferences);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [isUpdating, setIsUpdating] = useState(false);

  const refreshPreferences = async (): Promise<void> => {
    if (authStatus === 'hydrating') {
      return;
    }

    setStatus('loading');

    if (authStatus !== 'authenticated' || !session?.accessToken) {
      const storedPreferences = await readStoredPreferences();

      setPreferences(
        storedPreferences
          ? toUserPreferencesFromStored(storedPreferences)
          : createDefaultUserPreferences()
      );
      setStatus('ready');
      return;
    }

    const storedPreferences = await readStoredPreferences();

    try {
      const serverPreferences = await getUserPreferences(session.accessToken);
      const shouldSyncPendingPreferences =
        storedPreferences?.syncStatus === 'pending' &&
        (storedPreferences.defaultPreference !== serverPreferences.defaultPreference ||
          storedPreferences.passengerType !== serverPreferences.passengerType);

      const persistedPreferences = shouldSyncPendingPreferences
        ? await updateUserPreferences(session.accessToken, {
            defaultPreference: storedPreferences.defaultPreference,
            passengerType: storedPreferences.passengerType,
          })
        : serverPreferences;

      const effectivePreferences: UserPreferences = {
        ...persistedPreferences,
        routeModifiers: storedPreferences?.routeModifiers ?? [],
        voiceLanguage: storedPreferences?.voiceLanguage ?? createDefaultUserPreferences().voiceLanguage,
      };

      await writeStoredPreferences(
        toStoredPreferences(effectivePreferences, 'synced')
      );
      setPreferences(effectivePreferences);
      setStatus('ready');
    } catch (error) {
      const fallbackPreferences = storedPreferences
        ? toUserPreferencesFromStored(storedPreferences)
        : createDefaultUserPreferences();

      setPreferences(fallbackPreferences);
      setStatus('ready');

      if (error instanceof Error) {
        throw new ApiError(
          error instanceof ApiError ? error.statusCode : 500,
          error.message || PREFERENCES_FETCH_ERROR
        );
      }

      throw new ApiError(500, PREFERENCES_FETCH_ERROR);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        await refreshPreferences();
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.warn('Unable to refresh preferences', error);
      }
    };

    void loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [authStatus, session?.accessToken]);

  const updatePreferences = async (
    input: Pick<
      UserPreferences,
      'defaultPreference' | 'passengerType' | 'routeModifiers' | 'voiceLanguage'
    >
  ): Promise<UserPreferences> => {
    if (authStatus !== 'authenticated' || !session?.accessToken) {
      const nextPreferences: UserPreferences = {
        ...createDefaultUserPreferences(),
        defaultPreference: input.defaultPreference,
        passengerType: input.passengerType,
        routeModifiers: input.routeModifiers,
        voiceLanguage: input.voiceLanguage,
      };

      await writeStoredPreferences(toStoredPreferences(nextPreferences, 'pending'));
      setPreferences(nextPreferences);
      setStatus('ready');
      return nextPreferences;
    }

    setIsUpdating(true);

    try {
      const savedPreferences = await updateUserPreferences(session.accessToken, {
        defaultPreference: input.defaultPreference,
        passengerType: input.passengerType,
      });

      const nextPreferences: UserPreferences = {
        ...savedPreferences,
        routeModifiers: input.routeModifiers,
        voiceLanguage: input.voiceLanguage,
      };

      await writeStoredPreferences(toStoredPreferences(nextPreferences, 'synced'));
      setPreferences(nextPreferences);
      setStatus('ready');
      return nextPreferences;
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        status,
        isUpdating,
        updatePreferences,
        refreshPreferences,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = (): PreferencesContextValue => {
  const contextValue = useContext(PreferencesContext);

  if (!contextValue) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }

  return contextValue;
};
