import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, createSupabaseUserClientMock } = vi.hoisted(() => {
  const hoistedRpcMock = vi.fn();
  const hoistedCreateSupabaseUserClientMock = vi.fn(() => ({
    rpc: hoistedRpcMock
  }));

  return {
    rpcMock: hoistedRpcMock,
    createSupabaseUserClientMock: hoistedCreateSupabaseUserClientMock
  };
});

vi.mock("../src/config/supabase.js", () => ({
  createSupabaseUserClient: createSupabaseUserClientMock
}));

import { createSubmission } from "../src/models/community-submission.model.js";

describe("community-submission.model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates submissions through the atomic RPC path", async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: "submission-1",
        user_id: "user-123",
        submission_type: "route_update",
        status: "pending",
        title: "Route update",
        payload: { proposedValue: "Updated" },
        source_context: null,
        route_id: null,
        route_variant_id: null,
        review_notes: null,
        created_at: "2026-03-22T00:00:00.000Z",
        updated_at: "2026-03-22T00:00:00.000Z"
      },
      error: null
    });

    const submission = await createSubmission(
      {
        userId: "user-123",
        submissionType: "route_update",
        title: "Route update",
        payload: { proposedValue: "Updated" }
      },
      "test-token"
    );

    expect(createSupabaseUserClientMock).toHaveBeenCalledWith("test-token");
    expect(rpcMock).toHaveBeenCalledWith(
      "create_community_submission_with_proposal",
      expect.objectContaining({
        p_user_id: "user-123",
        p_submission_type: "route_update",
        p_title: "Route update"
      })
    );
    expect(submission.id).toBe("submission-1");
  });
});
