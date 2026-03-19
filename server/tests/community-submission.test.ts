import { EventEmitter } from "node:events";
import { createRequest, createResponse, type Body, type RequestMethod } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/auth.model.js", () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock("../src/models/community-submission.model.js", () => ({
    createSubmission: vi.fn(),
    findSubmissionsByUserId: vi.fn(),
}));

import app from "../src/app.js";
import * as authModel from "../src/models/auth.model.js";
import * as communitySubmissionModel from "../src/models/community-submission.model.js";
import type { CommunitySubmission } from "../src/models/community-submission.model.js";

const mockedAuthModel = vi.mocked(authModel);
const mockedCommunitySubmissionModel = vi.mocked(communitySubmissionModel);

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
    headers: options.headers,
  });
  const response = createResponse({ eventEmitter: EventEmitter });

  await new Promise<void>((resolve, reject) => {
    response.on("end", resolve);
    response.on("finish", resolve);
    appHandler.handle(request, response, (error: unknown) => {
      if (error) reject(error);
      else resolve();
    });
  });

  return response;
};

const mockAuthenticatedUser = () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        appMetadata: {},
        userMetadata: {},
    });
};

describe("/api/community", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("POST /submissions", () => {
        it("should return 401 if no auth token is provided", async () => {
            const response = await invokeApp({
                method: "POST",
                url: "/api/community/submissions",
                body: {},
            });
            expect(response.statusCode).toBe(401);
        });

        it("should return 400 for an invalid payload", async () => {
            mockAuthenticatedUser();
            const response = await invokeApp({
                method: "POST",
                url: "/api/community/submissions",
                headers: { Authorization: "Bearer test-token" },
                body: { title: "a" }, // missing submissionType and payload
            });
            expect(response.statusCode).toBe(400);
            expect(response._getJSONData().message).toBe("Validation failed");
        });

        it("should create a 'missing_route' submission successfully", async () => {
            mockAuthenticatedUser();
            const submission = {
                submissionType: "missing_route" as const,
                title: "Missing route from A to B",
                payload: { origin: "Point A", destination: "Point B" },
            };
            const createdSubmission: CommunitySubmission = {
                id: "sub-1",
                userId: "user-123",
                submissionType: "missing_route",
                status: "pending",
                title: submission.title,
                payload: submission.payload,
                sourceContext: null,
                reviewNotes: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            mockedCommunitySubmissionModel.createSubmission.mockResolvedValueOnce(createdSubmission);

            const response = await invokeApp({
                method: "POST",
                url: "/api/community/submissions",
                headers: { Authorization: "Bearer test-token" },
                body: submission,
            });

            expect(response.statusCode).toBe(201);
            expect(mockedCommunitySubmissionModel.createSubmission).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-123", ...submission }), "test-token"
            );
            expect(response._getJSONData().data.status).toBe("pending");
        });
    });

    describe("GET /submissions/mine", () => {
        it("should return 401 if no auth token is provided", async () => {
            const response = await invokeApp({
                method: "GET",
                url: "/api/community/submissions/mine",
            });
            expect(response.statusCode).toBe(401);
        });

        it("should return a list of the user's submissions", async () => {
            mockAuthenticatedUser();
            const submissions: CommunitySubmission[] = [
                {
                    id: "sub-1",
                    userId: "user-123",
                    submissionType: "missing_route",
                    status: "pending",
                    title: "Missing route",
                    payload: { origin: "A", destination: "B" },
                    sourceContext: null,
                    reviewNotes: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "sub-2",
                    userId: "user-123",
                    submissionType: "route_note",
                    status: "approved",
                    title: "Route note",
                    payload: { note: "Crowded", routeOrArea: "Pasay" },
                    sourceContext: null,
                    reviewNotes: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];
            mockedCommunitySubmissionModel.findSubmissionsByUserId.mockResolvedValueOnce(submissions);

            const response = await invokeApp({
                method: "GET",
                url: "/api/community/submissions/mine",
                headers: { Authorization: "Bearer test-token" },
            });

            expect(response.statusCode).toBe(200);
            expect(response._getJSONData().data).toHaveLength(2);
            expect(mockedCommunitySubmissionModel.findSubmissionsByUserId).toHaveBeenCalledWith("user-123", "test-token", undefined);
        });

        it("should filter submissions by status", async () => {
            mockAuthenticatedUser();
            mockedCommunitySubmissionModel.findSubmissionsByUserId.mockResolvedValueOnce([]);

            await invokeApp({
                method: "GET",
                url: "/api/community/submissions/mine?status=approved",
                headers: { Authorization: "Bearer test-token" },
            });

            expect(mockedCommunitySubmissionModel.findSubmissionsByUserId).toHaveBeenCalledWith("user-123", "test-token", "approved");
        });

        it("should return 400 for an invalid status filter", async () => {
            mockAuthenticatedUser();
            const response = await invokeApp({
                method: "GET",
                url: "/api/community/submissions/mine?status=invalid-status",
                headers: { Authorization: "Bearer test-token" },
            });
            expect(response.statusCode).toBe(400);
        });
    });
});
