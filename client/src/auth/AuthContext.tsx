import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as ExpoAuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import {
  ApiError,
  buildGoogleAuthStartUrl,
  getMe,
  refreshSession,
  signIn as signInRequest,
  signOut as signOutRequest,
  signUp as signUpRequest,
} from './api';
import {
  clearStoredAuthState,
  readHasCompletedOnboarding,
  readStoredAuthState,
  writeHasCompletedOnboarding,
  writeStoredAuthState,
} from './storage';
import {
  clearStoredPreferenceDraft,
  readStoredPreferenceDraft,
  writeStoredPreferences,
} from '../preferences/storage';
import {
  getMyPreferences,
  toPersistedPreferenceDraft,
  upsertMyPreferences,
} from '../preferences/api';
import { toStoredPreferences } from '../preferences/types';
import {
  hasAuthenticatedSession,
  type AuthPayload,
  type GoogleAuthOrigin,
  parseGoogleAuthCallbackResult,
  type AuthSession,
  type AuthStatus,
  type AuthUser,
  type StoredAuthState,
} from './types';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
  unauthenticatedRoute: 'Welcome' | 'Login';
  signIn: (email: string, password: string) => Promise<AuthPayload>;
  signUp: (email: string, password: string) => Promise<AuthPayload>;
  authenticateWithGoogle: (origin: GoogleAuthOrigin) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const HYDRATING_STATE: AuthState = {
  status: 'hydrating',
  user: null,
  session: null,
};

const UNAUTHENTICATED_STATE: AuthState = {
  status: 'unauthenticated',
  user: null,
  session: null,
};

const toAuthenticatedState = (value: StoredAuthState): AuthState => ({
  status: 'authenticated',
  user: value.user,
  session: value.session,
});

const GOOGLE_AUTH_REDIRECT_PATH = 'auth/callback';
const GOOGLE_AUTH_NATIVE_REDIRECT_URI = 'sakai://auth/callback';

const assertAuthenticatedPayload = (value: AuthPayload): StoredAuthState => {
  if (!hasAuthenticatedSession(value)) {
    throw new Error('The server did not return an authenticated session');
  }

  return {
    user: value.user,
    session: value.session,
  };
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(HYDRATING_STATE);
  const [unauthenticatedRoute, setUnauthenticatedRoute] = useState<'Welcome' | 'Login'>(
    'Welcome'
  );
  const googleAuthInFlightRef = useRef(false);

  const markOnboardingComplete = useCallback(async (): Promise<void> => {
    await writeHasCompletedOnboarding();
    setUnauthenticatedRoute('Login');
  }, []);
  const syncStoredPreferenceDraft = useCallback(async (accessToken: string): Promise<void> => {
    const storedDraft = await readStoredPreferenceDraft();

    if (!storedDraft) {
      return;
    }

    const currentPreferences = await getMyPreferences(accessToken);
    const persistedPreferences = currentPreferences.isPersisted
      ? currentPreferences
      : await upsertMyPreferences(accessToken, toPersistedPreferenceDraft(storedDraft));

    await writeStoredPreferences(
      toStoredPreferences(
        {
          ...persistedPreferences,
          routeModifiers: storedDraft.routeModifiers,
          voiceLanguage: storedDraft.voiceLanguage,
          commuteModes: storedDraft.commuteModes,
          allowCarAccess: storedDraft.allowCarAccess,
        },
        'synced'
      )
    );
    await clearStoredPreferenceDraft();
  }, []);

  const persistAuthenticatedState = useCallback(
    async (value: StoredAuthState): Promise<void> => {
      await writeStoredAuthState(value);

      try {
        await syncStoredPreferenceDraft(value.session.accessToken);
      } catch (error) {
        console.warn('Failed to sync onboarding preferences after authentication', {
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      }

      await markOnboardingComplete();
      setUnauthenticatedRoute('Login');
      setAuthState(toAuthenticatedState(value));
    },
    [markOnboardingComplete, syncStoredPreferenceDraft]
  );

  const clearAuthState = useCallback(
    async (route: 'Welcome' | 'Login' = 'Welcome'): Promise<void> => {
      await clearStoredAuthState();
      setUnauthenticatedRoute(route);
      setAuthState(UNAUTHENTICATED_STATE);
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    const hydrateAuthState = async () => {
      try {
        const [storedState, storedOnboardingCompleted] = await Promise.all([
          readStoredAuthState(),
          readHasCompletedOnboarding(),
        ]);

        if (isMounted) {
          setUnauthenticatedRoute(storedOnboardingCompleted ? 'Login' : 'Welcome');
        }

        if (!storedState) {
          if (isMounted) {
            setAuthState(UNAUTHENTICATED_STATE);
          }
          return;
        }

        const refreshedPayload = await refreshSession({
          refreshToken: storedState.session.refreshToken,
        });
        const nextState = assertAuthenticatedPayload(refreshedPayload);

        await persistAuthenticatedState(nextState);

        if (!isMounted) {
          return;
        }
      } catch {
        await clearAuthState();

        if (!isMounted) {
          return;
        }
      }
    };

    void hydrateAuthState();

    return () => {
      isMounted = false;
    };
  }, [clearAuthState, persistAuthenticatedState]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthPayload> => {
    const payload = await signInRequest({
      email: email.trim(),
      password,
    });
    const nextState = assertAuthenticatedPayload(payload);

    await persistAuthenticatedState(nextState);

    return payload;
  }, [persistAuthenticatedState]);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthPayload> => {
    const payload = await signUpRequest({
      email: email.trim(),
      password,
    });

    await markOnboardingComplete();
    await clearAuthState('Login');

    return payload;
  }, [clearAuthState, markOnboardingComplete]);

  const authenticateWithGoogle = useCallback(async (origin: GoogleAuthOrigin): Promise<void> => {
    if (googleAuthInFlightRef.current) {
      return;
    }

    googleAuthInFlightRef.current = true;
    const actionLabel = origin === 'signup' ? 'sign up' : 'sign in';
    try {
      const redirectUri = ExpoAuthSession.makeRedirectUri({
        native: GOOGLE_AUTH_NATIVE_REDIRECT_URI,
        scheme: 'sakai',
        path: GOOGLE_AUTH_REDIRECT_PATH,
      });
      const authResult = await WebBrowser.openAuthSessionAsync(
        buildGoogleAuthStartUrl(redirectUri),
        redirectUri
      );

      if (authResult.type !== 'success') {
        throw new Error(
          authResult.type === 'cancel'
            ? `Google ${actionLabel} was cancelled.`
            : `Google ${actionLabel} did not complete.`
        );
      }

      const callbackResult = parseGoogleAuthCallbackResult(authResult.url);

      if (callbackResult.status === 'error') {
        await clearAuthState();
        throw new ApiError(401, callbackResult.message);
      }

      const user = await getMe(callbackResult.session.accessToken);

      await persistAuthenticatedState({
        user,
        session: callbackResult.session,
      });
    } catch (error) {
      await clearAuthState();
      throw error;
    } finally {
      googleAuthInFlightRef.current = false;
    }
  }, [clearAuthState, persistAuthenticatedState]);

  const signOut = useCallback(async (): Promise<void> => {
    const accessToken = authState.session?.accessToken;

    try {
      if (accessToken) {
        await signOutRequest(accessToken);
      }
    } finally {
      await clearAuthState('Login');
    }
  }, [authState.session?.accessToken, clearAuthState]);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const currentSession = authState.session;

    if (!currentSession) {
      return null;
    }

    try {
      const user = await getMe(currentSession.accessToken);
      const nextState: StoredAuthState = {
        user,
        session: currentSession,
      };

      await persistAuthenticatedState(nextState);

      return user;
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) {
        throw error;
      }
    }

    try {
      const refreshedPayload = await refreshSession({
        refreshToken: currentSession.refreshToken,
      });
      const refreshedState = assertAuthenticatedPayload(refreshedPayload);
      const user = await getMe(refreshedState.session.accessToken);
      const nextState: StoredAuthState = {
        user,
        session: refreshedState.session,
      };

      await persistAuthenticatedState(nextState);

      return user;
    } catch {
      await clearAuthState();
      return null;
    }
  }, [authState.session, clearAuthState, persistAuthenticatedState]);

  const contextValue: AuthContextValue = {
    status: authState.status,
    user: authState.user,
    session: authState.session,
    unauthenticatedRoute,
    signIn,
    signUp,
    authenticateWithGoogle,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const contextValue = useContext(AuthContext);

  if (!contextValue) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return contextValue;
};
