import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn(),
  createSupabaseUserClient: vi.fn()
}));

import {
  createSupabaseUserClient,
  getSupabaseAdminClient
} from "../src/config/supabase.js";
import {
  getUserPreferenceByUserId,
  upsertUserPreference
} from "../src/models/user-preference.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedCreateSupabaseUserClient = vi.mocked(createSupabaseUserClient);

describe("user preference model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no preference row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });
    const eq = vi.fn().mockReturnValue({
      maybeSingle
    });
    const select = vi.fn().mockReturnValue({
      eq
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const result = await getUserPreferenceByUserId("user-1");

    expect(client.from).toHaveBeenCalledWith("user_preferences");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(result).toBeNull();
  });

  it("maps a persisted preference row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        default_preference: "balanced",
        passenger_type: "regular",
        created_at: "2026-03-19T10:05:00.000Z",
        updated_at: "2026-03-19T10:05:00.000Z"
      },
      error: null
    });
    const eq = vi.fn().mockReturnValue({
      maybeSingle
    });
    const select = vi.fn().mockReturnValue({
      eq
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const result = await getUserPreferenceByUserId("user-1");

    expect(result).toEqual({
      userId: "user-1",
      defaultPreference: "balanced",
      passengerType: "regular",
      createdAt: "2026-03-19T10:05:00.000Z",
      updatedAt: "2026-03-19T10:05:00.000Z"
    });
  });

  it("upserts a preference row by user id", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        default_preference: "cheapest",
        passenger_type: "student",
        created_at: "2026-03-19T10:05:00.000Z",
        updated_at: "2026-03-19T10:06:00.000Z"
      },
      error: null
    });
    const select = vi.fn().mockReturnValue({
      single
    });
    const upsert = vi.fn().mockReturnValue({
      select
    });
    const client = {
      from: vi.fn().mockReturnValue({
        upsert
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const result = await upsertUserPreference({
      userId: "user-1",
      defaultPreference: "cheapest",
      passengerType: "student"
    });

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        default_preference: "cheapest",
        passenger_type: "student"
      },
      {
        onConflict: "user_id"
      }
    );
    expect(result).toEqual({
      userId: "user-1",
      defaultPreference: "cheapest",
      passengerType: "student",
      createdAt: "2026-03-19T10:05:00.000Z",
      updatedAt: "2026-03-19T10:06:00.000Z"
    });
  });

  it("uses the user-scoped client when an access token is provided", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        default_preference: "fastest",
        passenger_type: "regular",
        created_at: "2026-03-19T10:05:00.000Z",
        updated_at: "2026-03-19T10:05:00.000Z"
      },
      error: null
    });
    const eq = vi.fn().mockReturnValue({
      maybeSingle
    });
    const select = vi.fn().mockReturnValue({
      eq
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select
      })
    };

    mockedCreateSupabaseUserClient.mockReturnValue(client as never);

    const result = await getUserPreferenceByUserId("user-1", "access-token");

    expect(mockedCreateSupabaseUserClient).toHaveBeenCalledWith("access-token");
    expect(mockedGetSupabaseAdminClient).not.toHaveBeenCalled();
    expect(result?.defaultPreference).toBe("fastest");
  });
});
