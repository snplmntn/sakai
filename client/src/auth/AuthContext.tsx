import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  ApiError,
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
  hasAuthenticatedSession,
  type AuthPayload,
  type AuthSession,
  type AuthStatus,
  type AuthUser,
  type StoredAuthState,
} from './types';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
  signIn: (email: string, password: string) => Promise<AuthPayload>;
  signUp: (email: string, password: string) => Promise<AuthPayload>;
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

  useEffect(() => {
    let isMounted = true;

    const hydrateAuthState = async () => {
      const storedState = await readStoredAuthState();

      if (!storedState) {
        if (isMounted) {
          setAuthState(UNAUTHENTICATED_STATE);
        }
        return;
      }

      try {
        const refreshedPayload = await refreshSession({
          refreshToken: storedState.session.refreshToken,
        });
        const nextState = assertAuthenticatedPayload(refreshedPayload);

        await writeStoredAuthState(nextState);

        if (isMounted) {
          setAuthState(toAuthenticatedState(nextState));
        }
      } catch {
        await clearStoredAuthState();

        if (isMounted) {
          setAuthState(UNAUTHENTICATED_STATE);
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

    await writeStoredAuthState(nextState);
    setAuthState(toAuthenticatedState(nextState));

    return payload;
  };

  const signUp = async (email: string, password: string): Promise<AuthPayload> => {
    const payload = await signUpRequest({
      email: email.trim(),
      password,
    });

    await clearStoredAuthState();
    setAuthState(UNAUTHENTICATED_STATE);

    return payload;
  };

  const signOut = async (): Promise<void> => {
    const accessToken = authState.session?.accessToken;

    try {
      if (accessToken) {
        await signOutRequest(accessToken);
      }
    } finally {
      await clearStoredAuthState();
      setAuthState(UNAUTHENTICATED_STATE);
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

      await writeStoredAuthState(nextState);
      setAuthState(toAuthenticatedState(nextState));

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

      await writeStoredAuthState(nextState);
      setAuthState(toAuthenticatedState(nextState));

      return user;
    } catch {
      await clearStoredAuthState();
      setAuthState(UNAUTHENTICATED_STATE);
      return null;
    }
  };

  const contextValue: AuthContextValue = {
    status: authState.status,
    user: authState.user,
    session: authState.session,
    signIn,
    signUp,
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
