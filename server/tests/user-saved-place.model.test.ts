import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/auth.model.js", () => ({
  getCurrentUser: vi.fn()
}));

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import * as authModel from "../src/models/auth.model.js";
import {
  createUserSavedPlace,
  deleteUserSavedPlace,
  listUserSavedPlaces,
  updateUserSavedPlace
} from "../src/models/user-saved-place.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedAuthModel = vi.mocked(authModel);

describe("user saved place model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists saved places from user metadata", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {
        saved_places: [
          {
            id: "saved-place-1",
            address: "123 Ayala Avenue, Barangay Bel-Air, Makati City, National Capital Region",
            labelKind: "preset",
            presetLabel: "office",
            customLabel: null,
            createdAt: "2026-03-20T09:00:00.000Z",
            updatedAt: "2026-03-20T10:00:00.000Z"
          }
        ]
      }
    });

    const result = await listUserSavedPlaces("user-1", "access-token");

    expect(mockedAuthModel.getCurrentUser).toHaveBeenCalledWith("access-token");
    expect(result).toEqual([
      {
        id: "saved-place-1",
        userId: "user-1",
        address: "123 Ayala Avenue, Barangay Bel-Air, Makati City, National Capital Region",
        labelKind: "preset",
        presetLabel: "office",
        customLabel: null,
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-20T10:00:00.000Z"
      }
    ]);
  });

  it("creates a saved place in user metadata", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: {},
      error: null
    });

    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {}
    });
    mockedGetSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          updateUserById
        }
      }
    } as never);

    const result = await createUserSavedPlace(
      {
        userId: "user-1",
        address: "123 Ayala Avenue, Barangay Bel-Air, Makati City, National Capital Region",
        labelKind: "preset",
        presetLabel: "office",
        customLabel: null
      },
      "access-token"
    );

    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          saved_places: [
            expect.objectContaining({
              address:
                "123 Ayala Avenue, Barangay Bel-Air, Makati City, National Capital Region",
              labelKind: "preset",
              presetLabel: "office"
            })
          ]
        })
      })
    );
    expect(result.labelKind).toBe("preset");
  });

  it("updates an existing saved place in user metadata", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: {},
      error: null
    });

    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {
        saved_places: [
          {
            id: "saved-place-1",
            address: "Old address",
            labelKind: "preset",
            presetLabel: "home",
            customLabel: null,
            createdAt: "2026-03-20T09:00:00.000Z",
            updatedAt: "2026-03-20T10:00:00.000Z"
          }
        ]
      }
    });
    mockedGetSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          updateUserById
        }
      }
    } as never);

    const result = await updateUserSavedPlace(
      {
        userId: "user-1",
        savedPlaceId: "saved-place-1",
        address: "New address",
        labelKind: "custom",
        presetLabel: null,
        customLabel: "Tutor"
      },
      "access-token"
    );

    expect(result.address).toBe("New address");
    expect(updateUserById).toHaveBeenCalled();
  });

  it("deletes a saved place from user metadata", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: {},
      error: null
    });

    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {
        saved_places: [
          {
            id: "saved-place-1",
            address: "Old address",
            labelKind: "preset",
            presetLabel: "home",
            customLabel: null,
            createdAt: "2026-03-20T09:00:00.000Z",
            updatedAt: "2026-03-20T10:00:00.000Z"
          }
        ]
      }
    });
    mockedGetSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          updateUserById
        }
      }
    } as never);

    await deleteUserSavedPlace(
      {
        userId: "user-1",
        savedPlaceId: "saved-place-1"
      },
      "access-token"
    );

    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          saved_places: []
        })
      })
    );
  });

  it("rejects duplicate preset labels", async () => {
    mockedAuthModel.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      appMetadata: {},
      userMetadata: {
        saved_places: [
          {
            id: "saved-place-1",
            address: "Old address",
            labelKind: "preset",
            presetLabel: "home",
            customLabel: null,
            createdAt: "2026-03-20T09:00:00.000Z",
            updatedAt: "2026-03-20T10:00:00.000Z"
          }
        ]
      }
    });

    await expect(
      createUserSavedPlace(
        {
          userId: "user-1",
          address: "Another home",
          labelKind: "preset",
          presetLabel: "home",
          customLabel: null
        },
        "access-token"
      )
    ).rejects.toThrowError("You can only keep one saved place for each preset label.");
  });
});
