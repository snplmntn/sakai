import { EventEmitter } from "node:events";

import {
  createRequest,
  createResponse,
  type Body,
  type RequestMethod
} from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/course.model.js", () => ({
  listCourses: vi.fn(),
  getCourseById: vi.fn(),
  createCourse: vi.fn()
}));

vi.mock("../src/models/auth.model.js", () => ({
  signUpWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  refreshAuthSession: vi.fn(),
  signOutAuthSession: vi.fn(),
  getCurrentUser: vi.fn(),
  getGoogleSignInUrl: vi.fn(),
  exchangeGoogleAuthCode: vi.fn(),
  buildAuthSuccessRedirectUrl: vi.fn(),
  buildAuthErrorRedirectUrl: vi.fn()
}));

vi.mock("../src/models/area-update.model.js", () => ({
  listAreaUpdates: vi.fn(),
  upsertAreaUpdates: vi.fn()
}));

vi.mock("../src/services/mmda-alert.service.js", () => ({
  refreshMmdaAlerts: vi.fn()
}));

import app from "../src/app.js";
import * as areaUpdateModel from "../src/models/area-update.model.js";
import * as authModel from "../src/models/auth.model.js";
import * as courseModel from "../src/models/course.model.js";

const mockedAreaUpdateModel = vi.mocked(areaUpdateModel);
const mockedAuthModel = vi.mocked(authModel);
const mockedCourseModel = vi.mocked(courseModel);
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
}) => {
  const request = createRequest({
    method: options.method,
    url: options.url,
    body: options.body
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

  it("rejects invalid create-course payloads", async () => {
    const response = await invokeApp({
      method: "POST",
      url: "/api/courses",
      body: {
        code: "",
        title: ""
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response._getJSONData().success).toBe(false);
    expect(response._getJSONData().message).toBe("Validation failed");
  });

  it("returns course data from the controller", async () => {
    mockedCourseModel.createCourse.mockResolvedValue({
      id: "cdb32fa6-bd17-4ad3-ae28-c0bcf8376c42",
      code: "CS101",
      title: "Intro to Sakai",
      description: "Starter course",
      createdAt: "2026-03-19T00:00:00.000Z"
    });

    const response = await invokeApp({
      method: "POST",
      url: "/api/courses",
      body: {
        code: "CS101",
        title: "Intro to Sakai",
        description: "Starter course"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(mockedCourseModel.createCourse).toHaveBeenCalledWith({
      code: "CS101",
      title: "Intro to Sakai",
      description: "Starter course"
    });
    expect(response._getJSONData().data).toEqual({
      id: "cdb32fa6-bd17-4ad3-ae28-c0bcf8376c42",
      code: "CS101",
      title: "Intro to Sakai",
      description: "Starter course",
      createdAt: "2026-03-19T00:00:00.000Z"
    });
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

    const response = await invokeApp({
      method: "GET",
      url: "/api/auth/google/callback?code=auth-code&state=signed-state"
    });

    expect(response.statusCode).toBe(302);
    expect(response._getRedirectUrl()).toBe("sakai://auth/callback#status=success");
  });

  it("redirects invalid google callbacks to the app error uri", async () => {
    mockedAuthModel.buildAuthErrorRedirectUrl.mockReturnValue(
      "sakai://auth/callback#status=error"
    );

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
});
