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

import app from "../src/app.js";
import * as courseModel from "../src/models/course.model.js";

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
});
