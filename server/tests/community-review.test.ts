import { EventEmitter } from "node:events";
import { createRequest, createResponse, type Body, type RequestMethod } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/auth.model.js", () => ({
  getCurrentUser: vi.fn()
}));

vi.mock("../src/models/community-review.model.js", () => ({
  listReviewQueue: vi.fn(),
  getProposalDetail: vi.fn(),
  promoteAnswerToProposal: vi.fn(),
  generateProposalAiDraft: vi.fn(),
  generateAnswerAiDraft: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn()
}));

import app from "../src/app.js";
import * as authModel from "../src/models/auth.model.js";
import * as communityReviewModel from "../src/models/community-review.model.js";

const mockedAuthModel = vi.mocked(authModel);
const mockedCommunityReviewModel = vi.mocked(communityReviewModel);

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
  const response = createResponse({ eventEmitter: EventEmitter });

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

const mockUser = (role?: string) => {
  mockedAuthModel.getCurrentUser.mockResolvedValue({
    id: "user-123",
    email: "reviewer@example.com",
    appMetadata: role ? { role } : {},
    userMetadata: {}
  });
};

describe("/api/community review endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks review queue access for non-reviewers", async () => {
    mockUser();

    const response = await invokeApp({
      method: "GET",
      url: "/api/community/review/queue",
      headers: { Authorization: "Bearer test-token" }
    });

    expect(response.statusCode).toBe(403);
  });

  it("promotes an answer for reviewers", async () => {
    mockUser("reviewer");
    mockedCommunityReviewModel.promoteAnswerToProposal.mockResolvedValue({
      id: "proposal-1"
    } as never);

    const response = await invokeApp({
      method: "POST",
      url: "/api/community/questions/question-1/answers/answer-1/promote",
      headers: { Authorization: "Bearer test-token" },
      body: {
        proposalType: "stop_correction",
        title: "Fix stop metadata",
        reviewedChangeSet: {
          stopId: "11111111-1111-4111-8111-111111111111",
          stopName: "Updated stop"
        }
      }
    });

    expect(response.statusCode).toBe(201);
    expect(mockedCommunityReviewModel.promoteAnswerToProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "question-1",
        answerId: "answer-1",
        reviewerUserId: "user-123"
      })
    );
  });

  it("rejects incomplete promotion payloads before the model layer", async () => {
    mockUser("reviewer");

    const response = await invokeApp({
      method: "POST",
      url: "/api/community/questions/question-1/answers/answer-1/promote",
      headers: { Authorization: "Bearer test-token" },
      body: {
        proposalType: "route_create",
        title: "Incomplete route",
        reviewedChangeSet: {
          route: {
            code: "R-1"
          }
        }
      }
    });

    expect(response.statusCode).toBe(400);
    expect(mockedCommunityReviewModel.promoteAnswerToProposal).not.toHaveBeenCalled();
  });

  it("approves a proposal for reviewers", async () => {
    mockUser("reviewer");
    mockedCommunityReviewModel.approveProposal.mockResolvedValue({
      id: "proposal-1"
    } as never);

    const response = await invokeApp({
      method: "POST",
      url: "/api/community/review/proposals/proposal-1/approve",
      headers: { Authorization: "Bearer test-token" },
      body: {
        changeSummary: "Published corrected stop details",
        reviewNotes: "Validated against field reports",
        reviewedChangeSet: {
          stopId: "11111111-1111-4111-8111-111111111111",
          stopName: "Updated stop"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockedCommunityReviewModel.approveProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "proposal-1",
        reviewerUserId: "user-123"
      })
    );
  });

  it("rejects a proposal for reviewers", async () => {
    mockUser("reviewer");
    mockedCommunityReviewModel.rejectProposal.mockResolvedValue({
      id: "proposal-1"
    } as never);

    const response = await invokeApp({
      method: "POST",
      url: "/api/community/review/proposals/proposal-1/reject",
      headers: { Authorization: "Bearer test-token" },
      body: {
        reviewNotes: "Could not verify the report"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockedCommunityReviewModel.rejectProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "proposal-1",
        reviewerUserId: "user-123"
      })
    );
  });
});
