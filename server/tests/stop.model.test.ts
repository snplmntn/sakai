import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import { findNearestStops, listStopsByPlaceId } from "../src/models/stop.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("stop model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists active stops for a place in a deterministic order", async () => {
    const eqIsActive = vi.fn().mockResolvedValue({
      data: [
        {
          id: "stop-2",
          place_id: "place-1",
          stop_name: "Main Gate",
          mode: "jeepney",
          area: "Sta. Mesa",
          latitude: 14.5987,
          longitude: 121.0109,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        },
        {
          id: "stop-1",
          place_id: "place-1",
          stop_name: "East Exit",
          mode: "jeepney",
          area: "Sta. Mesa",
          latitude: 14.5991,
          longitude: 121.0111,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const eqPlaceId = vi.fn().mockReturnValue({
      eq: eqIsActive
    });
    const select = vi.fn().mockReturnValue({
      eq: eqPlaceId
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const stops = await listStopsByPlaceId("place-1");

    expect(eqPlaceId).toHaveBeenCalledWith("place_id", "place-1");
    expect(eqIsActive).toHaveBeenCalledWith("is_active", true);
    expect(stops.map((stop) => stop.stopName)).toEqual(["East Exit", "Main Gate"]);
  });

  it("returns nearest active stops ordered by distance", async () => {
    const inMode = vi.fn().mockResolvedValue({
      data: [
        {
          id: "stop-1",
          place_id: null,
          stop_name: "Far Stop",
          mode: "jeepney",
          area: "Cubao",
          latitude: 14.6212,
          longitude: 121.0536,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        },
        {
          id: "stop-2",
          place_id: null,
          stop_name: "Near Stop",
          mode: "jeepney",
          area: "Cubao",
          latitude: 14.6196,
          longitude: 121.0513,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const eqIsActive = vi.fn().mockReturnValue({
      in: inMode
    });
    const select = vi.fn().mockReturnValue({
      eq: eqIsActive
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const stops = await findNearestStops({
      coordinates: {
        latitude: 14.6195,
        longitude: 121.0512
      },
      limit: 2,
      modes: ["jeepney"]
    });

    expect(inMode).toHaveBeenCalledWith("mode", ["jeepney"]);
    expect(stops.map((stop) => stop.stopName)).toEqual(["Near Stop", "Far Stop"]);
    expect(stops[0].distanceMeters).toBeLessThan(stops[1].distanceMeters);
  });

  it("filters inactive stops when loading by id", async () => {
    const eqIsActive = vi.fn().mockResolvedValue({
      data: [
        {
          id: "stop-1",
          place_id: null,
          stop_name: "Active Stop",
          mode: "jeepney",
          area: "Cubao",
          latitude: 14.6196,
          longitude: 121.0513,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const inIds = vi.fn().mockReturnValue({
      eq: eqIsActive
    });
    const select = vi.fn().mockReturnValue({
      in: inIds
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const { getStopsByIds } = await import("../src/models/stop.model.js");
    const stops = await getStopsByIds(["stop-1", "stop-2"]);

    expect(inIds).toHaveBeenCalledWith("id", ["stop-1", "stop-2"]);
    expect(eqIsActive).toHaveBeenCalledWith("is_active", true);
    expect(stops.map((stop) => stop.id)).toEqual(["stop-1"]);
  });
});
