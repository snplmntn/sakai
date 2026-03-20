import {
  createContext,
  useContext,
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
  readStoredAuthState,
  writeStoredAuthState,
} from './storage';
import {
  clearStoredPreferenceDraft,
  readStoredPreferenceDraft,
} from '../preferences/storage';
import {
  getMyPreferences,
  toPersistedPreferenceDraft,
  upsertMyPreferences,
} from '../preferences/api';
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

  const syncStoredPreferenceDraft = async (accessToken: string): Promise<void> => {
    const storedDraft = await readStoredPreferenceDraft();

    if (!storedDraft) {
      return;
    }

    const currentPreferences = await getMyPreferences(accessToken);

    if (currentPreferences.isPersisted) {
      await clearStoredPreferenceDraft();
      return;
    }

    await upsertMyPreferences(accessToken, toPersistedPreferenceDraft(storedDraft));
    await clearStoredPreferenceDraft();
  };

  const persistAuthenticatedState = async (value: StoredAuthState): Promise<void> => {
    await writeStoredAuthState(value);

    try {
      await syncStoredPreferenceDraft(value.session.accessToken);
    } catch (error) {
      console.warn('Failed to sync onboarding preferences after authentication', {
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }

    setUnauthenticatedRoute('Welcome');
    setAuthState(toAuthenticatedState(value));
  };

  const clearAuthState = async (
    route: 'Welcome' | 'Login' = 'Welcome'
  ): Promise<void> => {
    await clearStoredAuthState();
    setUnauthenticatedRoute(route);
    setAuthState(UNAUTHENTICATED_STATE);
  };

  useEffect(() => {
    let isMounted = true;

    const hydrateAuthState = async () => {
      try {
        const storedState = await readStoredAuthState();

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
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthPayload> => {
    const payload = await signInRequest({
      email: email.trim(),
      password,
    });
    const nextState = assertAuthenticatedPayload(payload);

    await persistAuthenticatedState(nextState);

    return payload;
  };

  const signUp = async (email: string, password: string): Promise<AuthPayload> => {
    const payload = await signUpRequest({
      email: email.trim(),
      password,
    });

    await clearAuthState('Welcome');

    return payload;
  };

  const authenticateWithGoogle = async (origin: GoogleAuthOrigin): Promise<void> => {
    if (googleAuthInFlightRef.current) {
      return;
    }

    googleAuthInFlightRef.current = true;
    const actionLabel = origin === 'signup' ? 'sign up' : 'sign in';
    try {
      const redirectUri = ExpoAuthSession.makeRedirectUri({
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
  };

  const signOut = async (): Promise<void> => {
    const accessToken = authState.session?.accessToken;

    try {
      if (accessToken) {
        await signOutRequest(accessToken);
      }
    } finally {
      await clearAuthState('Login');
    }
  };

  const refreshUser = async (): Promise<AuthUser | null> => {
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
  };

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
