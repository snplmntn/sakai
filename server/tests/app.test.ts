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
  listActiveAreaUpdates: vi.fn(),
  upsertAreaUpdates: vi.fn()
}));

vi.mock("../src/models/user-preference.model.js", () => ({
  getUserPreferenceByUserId: vi.fn(),
  upsertUserPreference: vi.fn()
}));

vi.mock("../src/models/user-saved-place.model.js", () => ({
  listUserSavedPlaces: vi.fn(),
  createUserSavedPlace: vi.fn(),
  updateUserSavedPlace: vi.fn(),
  deleteUserSavedPlace: vi.fn()
}));

vi.mock("../src/models/place.model.js", () => ({
  searchPlaces: vi.fn(),
  normalizePlaceSearchText: vi.fn((value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
  )
}));

vi.mock("../src/services/route-query.service.js", () => ({
  queryRoutes: vi.fn()
}));

vi.mock("../src/services/mmda-alert.service.js", () => ({
  refreshMmdaAlerts: vi.fn()
}));

vi.mock("../src/services/psgc.service.js", () => ({
  listRegions: vi.fn(),
  listProvincesByRegion: vi.fn(),
  listCitiesMunicipalitiesByRegion: vi.fn(),
  listCitiesMunicipalitiesByProvince: vi.fn(),
  listBarangaysByCityMunicipality: vi.fn()
}));

vi.mock("../src/services/speech.service.js", () => ({
  transcribeSpeech: vi.fn()
}));

import app from "../src/app.js";
import * as areaUpdateModel from "../src/models/area-update.model.js";
import * as authModel from "../src/models/auth.model.js";
import * as mmdaAlertService from "../src/services/mmda-alert.service.js";
import * as placeModel from "../src/models/place.model.js";
import * as psgcService from "../src/services/psgc.service.js";
import * as routeQueryService from "../src/services/route-query.service.js";
import * as speechService from "../src/services/speech.service.js";
import * as userPreferenceModel from "../src/models/user-preference.model.js";
import * as userSavedPlaceModel from "../src/models/user-saved-place.model.js";

const mockedAreaUpdateModel = vi.mocked(areaUpdateModel);
const mockedAuthModel = vi.mocked(authModel);
const mockedMmdaAlertService = vi.mocked(mmdaAlertService);
const mockedPlaceModel = vi.mocked(placeModel);
const mockedPsgcService = vi.mocked(psgcService);
const mockedRouteQueryService = vi.mocked(routeQueryService);
const mockedSpeechService = vi.mocked(speechService);
const mockedUserPreferenceModel = vi.mocked(userPreferenceModel);
const mockedUserSavedPlaceModel = vi.mocked(userSavedPlaceModel);
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
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.AUTH_APP_REDIRECT_URI = "sakai://auth/callback";
    process.env.AUTH_STATE_SIGNING_SECRET =
      "test-signing-secret-12345678901234567890";
    delete process.env.AUTH_GOOGLE_REDIRECT_URI;
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

  it("redirects browser google start requests to the provider url", async () => {
    mockedAuthModel.getGoogleSignInUrl.mockResolvedValue({
      url: "https://supabase.example.com/auth/v1/authorize?provider=google"
    });

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/start"
    });

    expect(response.statusCode).toBe(302);
    expect(response._getRedirectUrl()).toBe(
      "https://supabase.example.com/auth/v1/authorize?provider=google"
    );
    expect(mockedAuthModel.getGoogleSignInUrl).toHaveBeenCalledWith({
      callbackUrl: "http://localhost/api/auth/google/callback",
      appRedirectUri: undefined
    });
  });

  it("returns json for api google start requests", async () => {
    mockedAuthModel.getGoogleSignInUrl.mockResolvedValue({
      url: "https://supabase.example.com/auth/v1/authorize?provider=google"
    });

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/start",
      headers: {
        accept: "application/json"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: {
        url: "https://supabase.example.com/auth/v1/authorize?provider=google"
      }
    });
  });

  it("prefers AUTH_GOOGLE_REDIRECT_URI for google start", async () => {
    process.env.AUTH_GOOGLE_REDIRECT_URI = "https://api.example.com/api/auth/google/callback";
    mockedAuthModel.getGoogleSignInUrl.mockResolvedValue({
      url: "https://supabase.example.com/auth/v1/authorize?provider=google"
    });

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/start",
      headers: {
        accept: "application/json"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockedAuthModel.getGoogleSignInUrl).toHaveBeenCalledWith({
      callbackUrl: "https://api.example.com/api/auth/google/callback",
      appRedirectUri: undefined
    });
  });

  it("passes the app redirect uri through google start", async () => {
    mockedAuthModel.getGoogleSignInUrl.mockResolvedValue({
      url: "https://supabase.example.com/auth/v1/authorize?provider=google"
    });

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/start?appRedirectUri=sakai%3A%2F%2Fauth%2Fcallback",
      headers: {
        accept: "application/json"
      }
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
        severity: "medium",
        summary: "Crash near Ortigas Avenue is occupying one lane and may slow westbound travel.",
        corridorTags: ["ortigas"],
        normalizedLocation: "ortigas avenue",
        displayUntil: "2026-03-19T13:05:00.000Z",
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

  it("returns route-relevant area updates from the mounted route", async () => {
    mockedAreaUpdateModel.listActiveAreaUpdates.mockResolvedValue([
      {
        id: "update-1",
        externalId: "external-1",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Road crash incident",
        location: "Cubao corridor",
        direction: "EB",
        involved: "2 vehicles",
        reportedTimeText: "5:29 PM",
        laneStatus: "One lane occupied",
        trafficStatus: "MMDA enforcers are on site managing traffic",
        severity: "medium",
        summary: "Crash along the Cubao corridor may slow this route.",
        corridorTags: ["cubao"],
        normalizedLocation: "cubao corridor",
        displayUntil: "2026-03-19T13:05:00.000Z",
        rawText: "MMDA ALERT: Road crash incident at Cubao corridor...",
        scrapedAt: "2026-03-19T10:05:00.000Z",
        createdAt: "2026-03-19T10:05:00.000Z"
      }
    ]);

    const response = await invokeApp({
      method: "POST",
      url: "/api/area-updates/relevant",
      body: {
        corridorTags: ["cubao"],
        originLabel: "Cubao",
        destinationLabel: "PUP Sta. Mesa",
        limit: 3
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData().data).toEqual([
      expect.objectContaining({
        id: "update-1",
        alertType: "Road crash incident",
        severity: "medium"
      })
    ]);
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

  it("returns PSGC regions from the mounted route", async () => {
    mockedPsgcService.listRegions.mockResolvedValue([
      {
        code: "130000000",
        name: "NCR",
        regionName: "National Capital Region"
      }
    ]);

    const response = await invokeApp({
      method: "GET",
      url: "/api/psgc/regions"
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: [
        {
          code: "130000000",
          name: "NCR",
          regionName: "National Capital Region"
        }
      ]
    });
  });

  it("returns speech transcription metadata from the mounted route", async () => {
    mockedSpeechService.transcribeSpeech.mockResolvedValue({
      transcript: "Papunta sa Cubao",
      confidence: null,
      detectedLanguageCode: "fil-PH",
      detectedLanguageLabel: "Filipino / Tagalog",
      detectionMode: "auto"
    });

    const response = await invokeApp({
      method: "POST",
      url: "/api/speech/transcribe",
      body: {
        audioBase64: "YQ==",
        mimeType: "audio/aac",
        languageOverride: "fil-PH"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: {
        transcript: "Papunta sa Cubao",
        confidence: null,
        detectedLanguageCode: "fil-PH",
        detectedLanguageLabel: "Filipino / Tagalog",
        detectionMode: "auto"
      }
    });
    expect(mockedSpeechService.transcribeSpeech).toHaveBeenCalledWith({
      audioBase64: "YQ==",
      mimeType: "audio/aac",
      languageOverride: "fil-PH"
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

  it("lists saved places", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });
    mockedUserSavedPlaceModel.listUserSavedPlaces.mockResolvedValue([
      {
        id: "saved-place-1",
        userId: "user-1",
        address: "123 Ayala Avenue, Makati City",
        labelKind: "preset",
        presetLabel: "office",
        customLabel: null,
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-20T10:00:00.000Z"
      }
    ]);

    const response = await invokeApp({
      method: "GET",
      url: "/api/me/saved-places",
      headers: {
        authorization: "Bearer access-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: [
        {
          id: "saved-place-1",
          userId: "user-1",
          address: "123 Ayala Avenue, Makati City",
          labelKind: "preset",
          presetLabel: "office",
          customLabel: null,
          createdAt: "2026-03-20T09:00:00.000Z",
          updatedAt: "2026-03-20T10:00:00.000Z"
        }
      ]
    });
    expect(mockedUserSavedPlaceModel.listUserSavedPlaces).toHaveBeenCalledWith(
      "user-1",
      "access-token"
    );
  });

  it("rejects invalid saved place payloads", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });

    const response = await invokeApp({
      method: "POST",
      url: "/api/me/saved-places",
      headers: {
        authorization: "Bearer access-token"
      },
      body: {
        address: "123 Ayala Avenue, Makati City",
        labelKind: "preset"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response._getJSONData().message).toBe("Validation failed");
  });

  it("creates a saved place", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });
    mockedUserSavedPlaceModel.createUserSavedPlace.mockResolvedValue({
      id: "saved-place-1",
      userId: "user-1",
      address: "123 Ayala Avenue, Makati City",
      labelKind: "preset",
      presetLabel: "office",
      customLabel: null,
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-20T10:00:00.000Z"
    });

    const response = await invokeApp({
      method: "POST",
      url: "/api/me/saved-places",
      headers: {
        authorization: "Bearer access-token"
      },
      body: {
        address: "123 Ayala Avenue, Makati City",
        labelKind: "preset",
        presetLabel: "office"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response._getJSONData()).toEqual({
      success: true,
      data: {
        id: "saved-place-1",
        userId: "user-1",
        address: "123 Ayala Avenue, Makati City",
        labelKind: "preset",
        presetLabel: "office",
        customLabel: null,
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-20T10:00:00.000Z"
      }
    });
    expect(mockedUserSavedPlaceModel.createUserSavedPlace).toHaveBeenCalledWith(
      {
        userId: "user-1",
        address: "123 Ayala Avenue, Makati City",
        labelKind: "preset",
        presetLabel: "office",
        customLabel: null
      },
      "access-token"
    );
  });

  it("updates a saved place", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });
    mockedUserSavedPlaceModel.updateUserSavedPlace.mockResolvedValue({
      id: "saved-place-1",
      userId: "user-1",
      address: "456 Katipunan Avenue, Quezon City",
      labelKind: "custom",
      presetLabel: null,
      customLabel: "Tutor",
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-20T11:00:00.000Z"
    });

    const response = await invokeApp({
      method: "PUT",
      url: "/api/me/saved-places/3d8a2a5d-0a7c-4b32-b79b-f4b7e5ed9b30",
      headers: {
        authorization: "Bearer access-token"
      },
      body: {
        address: "456 Katipunan Avenue, Quezon City",
        labelKind: "custom",
        customLabel: "Tutor"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response._getJSONData().data).toEqual({
      id: "saved-place-1",
      userId: "user-1",
      address: "456 Katipunan Avenue, Quezon City",
      labelKind: "custom",
      presetLabel: null,
      customLabel: "Tutor",
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-20T11:00:00.000Z"
    });
    expect(mockedUserSavedPlaceModel.updateUserSavedPlace).toHaveBeenCalledWith(
      {
        userId: "user-1",
        savedPlaceId: "3d8a2a5d-0a7c-4b32-b79b-f4b7e5ed9b30",
        address: "456 Katipunan Avenue, Quezon City",
        labelKind: "custom",
        presetLabel: null,
        customLabel: "Tutor"
      },
      "access-token"
    );
  });

  it("deletes a saved place", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });

    const response = await invokeApp({
      method: "DELETE",
      url: "/api/me/saved-places/3d8a2a5d-0a7c-4b32-b79b-f4b7e5ed9b30",
      headers: {
        authorization: "Bearer access-token"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(mockedUserSavedPlaceModel.deleteUserSavedPlace).toHaveBeenCalledWith(
      {
        userId: "user-1",
        savedPlaceId: "3d8a2a5d-0a7c-4b32-b79b-f4b7e5ed9b30"
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
          matchedBy: "alias",
          latitude: 14.62,
          longitude: 121.05
        },
        destination: {
          placeId: "place-2",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName",
          latitude: 14.6,
          longitude: 121.01
        },
        preference: "cheapest",
        passengerType: "student",
        preferenceSource: "saved_preference",
        passengerTypeSource: "saved_preference",
        modifiers: [],
        modifierSource: "default"
      },
      options: [],
      googleFallback: {
        status: "no_results",
        options: [],
        message: "Google Maps did not return fallback transit routes."
      },
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
            matchedBy: "alias",
            latitude: 14.62,
            longitude: 121.05
          },
          destination: {
            placeId: "place-2",
            label: "PUP Sta. Mesa",
            matchedBy: "canonicalName",
            latitude: 14.6,
            longitude: 121.01
          },
          preference: "cheapest",
          passengerType: "student",
          preferenceSource: "saved_preference",
          passengerTypeSource: "saved_preference",
          modifiers: [],
          modifierSource: "default"
        },
        options: [],
        googleFallback: {
          status: "no_results",
          options: [],
          message: "Google Maps did not return fallback transit routes."
        },
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
          matchedBy: "alias",
          latitude: 14.62,
          longitude: 121.05
        },
        destination: {
          placeId: "place-2",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName",
          latitude: 14.6,
          longitude: 121.01
        },
        preference: "cheapest",
        passengerType: "regular",
        preferenceSource: "ai_parsed",
        passengerTypeSource: "default",
        modifiers: [],
        modifierSource: "default"
      },
      options: [],
      googleFallback: {
        status: "no_results",
        options: [],
        message: "Google Maps did not return fallback transit routes."
      }
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
