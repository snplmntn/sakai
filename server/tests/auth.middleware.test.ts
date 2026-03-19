import { createRequest, createResponse } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/auth.model.js", () => ({
  getCurrentUser: vi.fn()
}));

import {
  authenticateOptionalRequest,
  authenticateRequest,
  getAuthenticatedLocals
} from "../src/middlewares/auth.middleware.js";
import * as authModel from "../src/models/auth.model.js";

const mockedAuthModel = vi.mocked(authModel);

describe("auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without an authorization header", async () => {
    const request = createRequest();
    const response = createResponse();
    const next = vi.fn();

    await authenticateRequest(request, response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: "Missing authorization header"
    }));
  });

  it("attaches the access token and user to response locals", async () => {
    const request = createRequest({
      headers: {
        authorization: "Bearer access-token"
      }
    });
    const response = createResponse();
    const next = vi.fn();

    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });

    await authenticateRequest(request, response, next);

    expect(mockedAuthModel.getCurrentUser).toHaveBeenCalledWith("access-token");
    expect(next).toHaveBeenCalledWith();
    expect(getAuthenticatedLocals(response)).toEqual({
      accessToken: "access-token",
      user: {
        id: "user-1",
        email: "user@example.com",
        appMetadata: {},
        userMetadata: {}
      }
    });
  });

  it("allows optional auth when no authorization header is present", async () => {
    const request = createRequest();
    const response = createResponse();
    const next = vi.fn();

    await authenticateOptionalRequest(request, response, next);

    expect(mockedAuthModel.getCurrentUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(response.locals).toEqual({});
  });
});
