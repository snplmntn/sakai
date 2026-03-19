import { EventEmitter } from "node:events";

import {
  createRequest,
  createResponse,
  type Body,
  type RequestMethod
} from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/auth.model.js", () => ({
  signUpWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  refreshAuthSession: vi.fn(),
  signOutAuthSession: vi.fn(),
  getCurrentUser: vi.fn(),
  getGoogleSignInUrl: vi.fn(),
  exchangeGoogleAuthCode: vi.fn(),
  verifySignedAuthState: vi.fn(),
  getDefaultAppRedirectUri: vi.fn(),
  buildAuthSuccessRedirectUrl: vi.fn(),
  buildAuthErrorRedirectUrl: vi.fn()
}));

vi.mock("../src/models/area-update.model.js", () => ({
  listAreaUpdates: vi.fn(),
  upsertAreaUpdates: vi.fn()
}));

vi.mock("../src/models/user-preference.model.js", () => ({
  getUserPreferenceByUserId: vi.fn(),
  upsertUserPreference: vi.fn()
}));

vi.mock("../src/models/place.model.js", () => ({
  searchPlaces: vi.fn()
}));

vi.mock("../src/services/route-query.service.js", () => ({
  queryRoutes: vi.fn()
}));

vi.mock("../src/services/mmda-alert.service.js", () => ({
  refreshMmdaAlerts: vi.fn()
}));

import app from "../src/app.js";
import * as areaUpdateModel from "../src/models/area-update.model.js";
import * as authModel from "../src/models/auth.model.js";
import * as mmdaAlertService from "../src/services/mmda-alert.service.js";
import * as placeModel from "../src/models/place.model.js";
import * as routeQueryService from "../src/services/route-query.service.js";
import * as userPreferenceModel from "../src/models/user-preference.model.js";

const mockedAreaUpdateModel = vi.mocked(areaUpdateModel);
const mockedAuthModel = vi.mocked(authModel);
const mockedMmdaAlertService = vi.mocked(mmdaAlertService);
const mockedPlaceModel = vi.mocked(placeModel);
const mockedRouteQueryService = vi.mocked(routeQueryService);
const mockedUserPreferenceModel = vi.mocked(userPreferenceModel);
const appHandler = app as unknown as {
  handle: (
    request: ReturnType<typeof createRequest>,
    response: ReturnType<typeof createResponse>,
    next: (error?: unknown) => void
  ) => void;
};

const invokeApp = async (options: {
  method: RequestMethod;
  url: string;
  body?: Body;
  headers?: Record<string, string>;
}) => {
  const request = createRequest({
    method: options.method,
    url: options.url,
    body: options.body,
    headers: options.headers
  });
  const response = createResponse({
    eventEmitter: EventEmitter
  });

  await new Promise<void>((resolve, reject) => {
    response.on("end", resolve);
    response.on("finish", resolve);

    appHandler.handle(request, response, (error: unknown) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return response;
};

describe("app routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns health status", async () => {
    const response = await invokeApp({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      message: "Server is running"
    });
  });

  it("returns JSON for unknown routes", async () => {
    const response = await invokeApp({
      method: "GET",
      url: "/api/missing"
    });

    expect(response.statusCode).toBe(404);
    expect(response._getJSONData().success).toBe(false);
    expect(response._getJSONData().message).toContain("Route GET /api/missing not found");
  });

  it("rejects invalid auth sign-up payloads", async () => {
    const response = await invokeApp({
      method: "POST",
      url: "/api/auth/sign-up",
      body: {
        email: "not-an-email",
        password: "short"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response._getJSONData().success).toBe(false);
    expect(response._getJSONData().message).toBe("Validation failed");
  });

  it("returns a google sign-in url from the auth controller", async () => {
    mockedAuthModel.getGoogleSignInUrl.mockResolvedValue({
      url: "https://supabase.example.com/auth/v1/authorize?provider=google"
    });

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/start"
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: {
        url: "https://supabase.example.com/auth/v1/authorize?provider=google"
      }
    });
    expect(mockedAuthModel.getGoogleSignInUrl).toHaveBeenCalledWith({
      callbackUrl: "http://localhost/api/auth/google/callback",
      appRedirectUri: undefined
    });
  });

  it("passes the app redirect uri through google start", async () => {
    mockedAuthModel.getGoogleSignInUrl.mockResolvedValue({
      url: "https://supabase.example.com/auth/v1/authorize?provider=google"
    });

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/start?appRedirectUri=sakai%3A%2F%2Fauth%2Fcallback"
    });

    expect(response.statusCode).toBe(200);
    expect(mockedAuthModel.getGoogleSignInUrl).toHaveBeenCalledWith({
      callbackUrl: "http://localhost/api/auth/google/callback",
      appRedirectUri: "sakai://auth/callback"
    });
  });

  it("requires a bearer token for the me endpoint", async () => {
    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response._getJSONData()).toEqual({
      success: false,
      message: "Missing authorization header",
      details: null
    });
  });

  it("redirects successful google callbacks to the app redirect uri", async () => {
    mockedAuthModel.exchangeGoogleAuthCode.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        appMetadata: {},
        userMetadata: {}
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
    mockedAuthModel.buildAuthSuccessRedirectUrl.mockReturnValue(
      "sakai://auth/callback#status=success"
    );
    mockedAuthModel.getDefaultAppRedirectUri.mockReturnValue("sakai://auth/callback");
    mockedAuthModel.verifySignedAuthState.mockReturnValue({
      codeVerifier: "code-verifier-123456789012345678901234567890123",
      appRedirectUri: "sakai://auth/callback",
      iat: 1_800_000_000,
      exp: 1_800_000_600
    } as never);

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/callback?code=auth-code&state=signed-state"
    });

    expect(response.statusCode).toBe(302);
    expect(response._getRedirectUrl()).toBe("sakai://auth/callback#status=success");
    expect(mockedAuthModel.buildAuthSuccessRedirectUrl).toHaveBeenCalledWith(
      expect.any(Object),
      "sakai://auth/callback"
    );
  });

  it("redirects invalid google callbacks to the app error uri", async () => {
    mockedAuthModel.buildAuthErrorRedirectUrl.mockReturnValue(
      "sakai://auth/callback#status=error"
    );
    mockedAuthModel.getDefaultAppRedirectUri.mockReturnValue("sakai://auth/callback");

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/callback?code=auth-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response._getRedirectUrl()).toBe("sakai://auth/callback#status=error");
  });

  it("returns area updates from the mounted route", async () => {
    mockedAreaUpdateModel.listAreaUpdates.mockResolvedValue([
      {
        id: "update-1",
        externalId: "external-1",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Road crash incident",
        location: "Ortigas Avenue",
        direction: "WB",
        involved: "2 motorcycles",
        reportedTimeText: "5:29 PM",
        laneStatus: "One lane occupied",
        trafficStatus: "MMDA enforcers are on site managing traffic",
        rawText: "MMDA ALERT: Road crash incident at Ortigas Avenue WB...",
        scrapedAt: "2026-03-19T10:05:00.000Z",
        createdAt: "2026-03-19T10:05:00.000Z"
      }
    ]);

    const response = await invokeApp({
      method: "GET",
      url: "/api/area-updates"
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData().data).toHaveLength(1);
    expect(mockedAreaUpdateModel.listAreaUpdates).toHaveBeenCalledWith({
      area: undefined,
      limit: 10
    });
  });

  it("returns place suggestions from the mounted route", async () => {
    mockedPlaceModel.searchPlaces.mockResolvedValue([
      {
        id: "place-1",
        canonicalName: "Pasay",
        city: "Pasay",
        kind: "terminal",
        latitude: 14.537745,
        longitude: 121.001557,
        googlePlaceId: null,
        createdAt: "2026-03-19T10:05:00.000Z",
        matchedBy: "alias",
        matchedText: "Pasay Rotonda"
      }
    ]);

    const response = await invokeApp({
      method: "GET",
      url: "/api/places/search?q=pasay&limit=5"
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData().data).toHaveLength(1);
    expect(mockedPlaceModel.searchPlaces).toHaveBeenCalledWith("pasay", {
      limit: 5
    });
  });

  it("requires a bearer token for area update refresh", async () => {
    const response = await invokeApp({
      method: "POST",
      url: "/api/area-updates/refresh"
    });

    expect(response.statusCode).toBe(401);
    expect(response._getJSONData()).toEqual({
      success: false,
      message: "Missing authorization header",
      details: null
    });
    expect(mockedMmdaAlertService.refreshMmdaAlerts).not.toHaveBeenCalled();
  });

  it("returns default preferences when no persisted row exists", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });
    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);

    const response = await invokeApp({
      method: "GET",
      url: "/api/me/preferences",
      headers: {
        authorization: "Bearer access-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: {
        userId: "user-1",
        defaultPreference: "balanced",
        passengerType: "regular",
        isPersisted: false,
        createdAt: null,
        updatedAt: null
      }
    });
    expect(mockedUserPreferenceModel.getUserPreferenceByUserId).toHaveBeenCalledWith(
      "user-1",
      "access-token"
    );
  });

  it("requires a bearer token for preferences", async () => {
    const response = await invokeApp({
      method: "GET",
      url: "/api/me/preferences"
    });

    expect(response.statusCode).toBe(401);
    expect(response._getJSONData()).toEqual({
      success: false,
      message: "Missing authorization header",
      details: null
    });
  });

  it("rejects malformed bearer tokens for preferences", async () => {
    const response = await invokeApp({
      method: "GET",
      url: "/api/me/preferences",
      headers: {
        authorization: "Token access-token"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response._getJSONData()).toEqual({
      success: false,
      message: "Authorization header must use Bearer token format",
      details: null
    });
  });

  it("rejects invalid preference payloads", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });

    const response = await invokeApp({
      method: "PUT",
      url: "/api/me/preferences",
      headers: {
        authorization: "Bearer access-token"
      },
      body: {
        defaultPreference: "slowest",
        passengerType: "student"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response._getJSONData().message).toBe("Validation failed");
  });

  it("updates persisted preferences", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });
    mockedUserPreferenceModel.upsertUserPreference.mockResolvedValue({
      userId: "user-1",
      defaultPreference: "cheapest",
      passengerType: "student",
      createdAt: "2026-03-19T10:05:00.000Z",
      updatedAt: "2026-03-19T10:05:00.000Z"
    });

    const response = await invokeApp({
      method: "PUT",
      url: "/api/me/preferences",
      headers: {
        authorization: "Bearer access-token"
      },
      body: {
        defaultPreference: "cheapest",
        passengerType: "student"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: {
        userId: "user-1",
        defaultPreference: "cheapest",
        passengerType: "student",
        isPersisted: true,
        createdAt: "2026-03-19T10:05:00.000Z",
        updatedAt: "2026-03-19T10:05:00.000Z"
      }
    });
    expect(mockedUserPreferenceModel.upsertUserPreference).toHaveBeenCalledWith(
      {
        userId: "user-1",
        defaultPreference: "cheapest",
        passengerType: "student"
      },
      "access-token"
    );
  });

  it("validates route query payloads", async () => {
    const response = await invokeApp({
      method: "POST",
      url: "/api/routes/query",
      body: {
        origin: {
          latitude: 14.6
        },
        destination: {
          label: "PUP Sta. Mesa"
        }
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response._getJSONData()).toEqual({
      success: false,
      message: "Validation failed",
      details: {
        fieldErrors: {
          origin: [
            "Either placeId, googlePlaceId, label, or coordinates are required",
            "Latitude and longitude must be provided together"
          ]
        },
        formErrors: []
      }
    });
  });

  it("returns route query results from the mounted route", async () => {
    mockedRouteQueryService.queryRoutes.mockResolvedValue({
      normalizedQuery: {
        origin: {
          placeId: "place-1",
          label: "Cubao",
          matchedBy: "alias"
        },
        destination: {
          placeId: "place-2",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName"
        },
        preference: "cheapest",
        passengerType: "student",
        preferenceSource: "saved_preference",
        passengerTypeSource: "saved_preference"
      },
      options: [],
      message: "No supported route found for Cubao to PUP Sta. Mesa in the current coverage"
    });

    const response = await invokeApp({
      method: "POST",
      url: "/api/routes/query",
      body: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "PUP Sta. Mesa"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: {
        normalizedQuery: {
          origin: {
            placeId: "place-1",
            label: "Cubao",
            matchedBy: "alias"
          },
          destination: {
            placeId: "place-2",
            label: "PUP Sta. Mesa",
            matchedBy: "canonicalName"
          },
          preference: "cheapest",
          passengerType: "student",
          preferenceSource: "saved_preference",
          passengerTypeSource: "saved_preference"
        },
        options: [],
        message: "No supported route found for Cubao to PUP Sta. Mesa in the current coverage"
      }
    });
    expect(mockedRouteQueryService.queryRoutes).toHaveBeenCalledWith({
      request: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "PUP Sta. Mesa"
        }
      },
      userId: undefined,
      accessToken: undefined
    });
  });

  it("accepts queryText-only route queries", async () => {
    mockedRouteQueryService.queryRoutes.mockResolvedValue({
      normalizedQuery: {
        origin: {
          placeId: "place-1",
          label: "Cubao",
          matchedBy: "alias"
        },
        destination: {
          placeId: "place-2",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName"
        },
        preference: "cheapest",
        passengerType: "regular",
        preferenceSource: "ai_parsed",
        passengerTypeSource: "default"
      },
      options: []
    });

    const response = await invokeApp({
      method: "POST",
      url: "/api/routes/query",
      body: {
        queryText: "cheapest way to PUP Sta. Mesa from Cubao"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockedRouteQueryService.queryRoutes).toHaveBeenCalledWith({
      request: {
        queryText: "cheapest way to PUP Sta. Mesa from Cubao"
      },
      userId: undefined,
      accessToken: undefined
    });
  });

  it("rejects invalid bearer tokens on optional route auth", async () => {
    const response = await invokeApp({
      method: "POST",
      url: "/api/routes/query",
      headers: {
        authorization: "Token access-token"
      },
      body: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "PUP Sta. Mesa"
        }
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response._getJSONData()).toEqual({
      success: false,
      message: "Authorization header must use Bearer token format",
      details: null
    });
    expect(mockedRouteQueryService.queryRoutes).not.toHaveBeenCalled();
  });
});
