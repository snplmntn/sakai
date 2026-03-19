import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    AUTH_GOOGLE_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
    AUTH_APP_REDIRECT_URI: "sakai://auth/callback",
    AUTH_STATE_SIGNING_SECRET: "12345678901234567890123456789012"
  }))
}));

vi.mock("../src/config/supabase.js", () => ({
  createSupabaseAuthClient: vi.fn(),
  getSupabaseAdminClient: vi.fn()
}));

import {
  createSupabaseAuthClient,
  getSupabaseAdminClient
} from "../src/config/supabase.js";
import {
  buildAuthErrorRedirectUrl,
  buildAuthSuccessRedirectUrl,
  createSignedAuthState,
  exchangeGoogleAuthCode,
  getCurrentUser,
  getGoogleSignInUrl,
  refreshAuthSession,
  signInWithEmailAndPassword,
  signOutAuthSession,
  signUpWithEmailAndPassword,
  verifySignedAuthState
} from "../src/models/auth.model.js";

const mockedCreateSupabaseAuthClient = vi.mocked(createSupabaseAuthClient);
const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("auth model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps sign up responses that require email confirmation", async () => {
    mockedCreateSupabaseAuthClient.mockReturnValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
              app_metadata: {
                provider: "email"
              },
              user_metadata: {}
            },
            session: null
          },
          error: null
        })
      }
    } as never);

    const result = await signUpWithEmailAndPassword({
      email: "user@example.com",
      password: "password123"
    });

    expect(result).toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        appMetadata: {
          provider: "email"
        },
        userMetadata: {}
      },
      session: null,
      requiresEmailConfirmation: true
    });
  });

  it("maps sign in responses into normalized auth payloads", async () => {
    mockedCreateSupabaseAuthClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
              app_metadata: {
                provider: "email"
              },
              user_metadata: {
                role: "commuter"
              }
            },
            session: {
              access_token: "access-token",
              refresh_token: "refresh-token",
              expires_in: 3600,
              expires_at: 1_800_000_000,
              token_type: "bearer"
            }
          },
          error: null
        })
      }
    } as never);

    const result = await signInWithEmailAndPassword({
      email: "user@example.com",
      password: "password123"
    });

    expect(result).toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        appMetadata: {
          provider: "email"
        },
        userMetadata: {
          role: "commuter"
        }
      },
      session: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
        expiresAt: 1_800_000_000,
        tokenType: "bearer"
      },
      requiresEmailConfirmation: false
    });
  });

  it("refreshes sessions using the refresh token", async () => {
    mockedCreateSupabaseAuthClient.mockReturnValue({
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
              app_metadata: {},
              user_metadata: {}
            },
            session: {
              access_token: "new-access-token",
              refresh_token: "new-refresh-token",
              expires_in: 3600,
              expires_at: 1_800_000_100,
              token_type: "bearer"
            }
          },
          error: null
        })
      }
    } as never);

    const result = await refreshAuthSession({
      refreshToken: "refresh-token"
    });

    expect(result.session?.accessToken).toBe("new-access-token");
  });

  it("starts Google sign in with a signed state and pkce challenge", async () => {
    const result = await getGoogleSignInUrl({
      now: new Date("2026-03-19T10:05:00.000Z")
    });
    const url = new URL(result.url);
    const state = url.searchParams.get("state");

    expect(url.origin).toBe("https://example.supabase.co");
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toBe(
      "http://localhost:3000/api/auth/google/callback"
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    expect(state).toBeTruthy();
    expect(
      verifySignedAuthState(state ?? "", {
        now: new Date("2026-03-19T10:10:00.000Z")
      }).codeVerifier
    ).toHaveLength(43);
  });

  it("rejects tampered signed auth state values", () => {
    const state = createSignedAuthState("test-code-verifier-123456789012345678901234567", {
      now: new Date("2026-03-19T10:05:00.000Z")
    });
    const [encodedPayload, encodedSignature] = state.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        codeVerifier: "another-code-verifier-123456789012345678901234",
        iat: 1_779_911_100,
        exp: 1_779_911_700
      })
    ).toString("base64url");
    const tamperedState = `${tamperedPayload}.${encodedSignature}`;

    expect(() =>
      verifySignedAuthState(tamperedState, {
        now: new Date("2026-03-19T10:06:00.000Z")
      })
    ).toThrowError("Invalid OAuth state");
  });

  it("exchanges the Google auth code using the signed pkce verifier", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "google-access-token",
          refresh_token: "google-refresh-token",
          expires_in: 3600,
          expires_at: 1_800_000_200,
          token_type: "bearer",
          user: {
            id: "user-1",
            email: "user@example.com",
            app_metadata: {
              provider: "google"
            },
            user_metadata: {}
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    const state = createSignedAuthState(
      "test-code-verifier-123456789012345678901234567",
      {
        now: new Date("2026-03-19T10:05:00.000Z")
      }
    );

    const result = await exchangeGoogleAuthCode(
      {
        code: "auth-code",
        state
      },
      {
        fetchImpl,
        now: new Date("2026-03-19T10:06:00.000Z")
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/token?grant_type=pkce",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-key"
        })
      })
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      auth_code: "auth-code",
      code_verifier: "test-code-verifier-123456789012345678901234567"
    });
    expect(result.user?.appMetadata).toEqual({
      provider: "google"
    });
  });

  it("builds app redirect urls for success and failure callback handoff", () => {
    const successRedirect = buildAuthSuccessRedirectUrl({
      user: {
        id: "user-1",
        email: "user@example.com",
        appMetadata: {
          provider: "google"
        },
        userMetadata: {}
      },
      session: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
        expiresAt: 1_800_000_200,
        tokenType: "bearer"
      },
      requiresEmailConfirmation: false
    });
    const errorRedirect = buildAuthErrorRedirectUrl(
      "oauth_exchange_failed",
      "Something went wrong"
    );
    const successUrl = new URL(successRedirect);
    const successParams = new URLSearchParams(successUrl.hash.slice(1));
    const errorUrl = new URL(errorRedirect);
    const errorParams = new URLSearchParams(errorUrl.hash.slice(1));

    expect(successUrl.toString()).toContain("sakai://auth/callback#");
    expect(successParams.get("status")).toBe("success");
    expect(successParams.get("access_token")).toBe("access-token");
    expect(successParams.get("email")).toBe("user@example.com");
    expect(errorParams.get("status")).toBe("error");
    expect(errorParams.get("error")).toBe("oauth_exchange_failed");
  });

  it("fetches the current user from an access token", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
          app_metadata: {},
          user_metadata: {
            role: "commuter"
          }
        }
      },
      error: null
    });

    mockedCreateSupabaseAuthClient.mockReturnValue({
      auth: {
        getUser
      }
    } as never);

    const user = await getCurrentUser("access-token");

    expect(getUser).toHaveBeenCalledWith("access-token");
    expect(user).toEqual({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {
        role: "commuter"
      }
    });
  });

  it("signs out the current session with local scope", async () => {
    const signOut = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });

    mockedGetSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          signOut
        }
      }
    } as never);

    await signOutAuthSession("access-token");

    expect(signOut).toHaveBeenCalledWith("access-token", "local");
  });
});
