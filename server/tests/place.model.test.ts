import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import { resolvePlaceReference } from "../src/models/place.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("place model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a place from a normalized alias", async () => {
    const placesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: "place-1",
            canonical_name: "PUP Sta. Mesa",
            city: "Manila",
            kind: "campus",
            latitude: 14.5987,
            longitude: 121.0109,
            google_place_id: null,
            created_at: "2026-03-19T10:05:00.000Z"
          }
        ],
        error: null
      })
    });
    const aliasesSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: "alias-1",
            place_id: "place-1",
            alias: "PUP Sta Mesa",
            normalized_alias: "pup sta mesa"
          }
        ],
        error: null
      })
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "place_aliases") {
          return {
            select: aliasesSelect
          };
        }

        if (table === "places") {
          return {
            select: placesSelect
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const result = await resolvePlaceReference({
      query: "PUP Sta. Mesa"
    });

    expect(result).toEqual({
      status: "resolved",
      place: {
        id: "place-1",
        canonicalName: "PUP Sta. Mesa",
        city: "Manila",
        kind: "campus",
        latitude: 14.5987,
        longitude: 121.0109,
        googlePlaceId: null,
        createdAt: "2026-03-19T10:05:00.000Z",
        matchedBy: "alias",
        matchedText: "PUP Sta Mesa"
      }
    });
  });

  it("returns an ambiguous result when multiple aliases match", async () => {
    const placesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: "place-2",
            canonical_name: "SM Megamall",
            city: "Mandaluyong",
            kind: "mall",
            latitude: 14.585,
            longitude: 121.056,
            google_place_id: null,
            created_at: "2026-03-19T10:05:00.000Z"
          },
          {
            id: "place-1",
            canonical_name: "SM North EDSA",
            city: "Quezon City",
            kind: "mall",
            latitude: 14.6567,
            longitude: 121.0293,
            google_place_id: null,
            created_at: "2026-03-19T10:05:00.000Z"
          }
        ],
        error: null
      })
    });
    const aliasesSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: "alias-1",
            place_id: "place-1",
            alias: "SM",
            normalized_alias: "sm"
          },
          {
            id: "alias-2",
            place_id: "place-2",
            alias: "SM",
            normalized_alias: "sm"
          }
        ],
        error: null
      })
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "place_aliases") {
          return {
            select: aliasesSelect
          };
        }

        if (table === "places") {
          return {
            select: placesSelect
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const result = await resolvePlaceReference({
      query: "SM"
    });

    expect(result.status).toBe("ambiguous");

    if (result.status !== "ambiguous") {
      throw new Error("Expected an ambiguous place result");
    }

    expect(result.matches.map((match) => match.canonicalName)).toEqual([
      "SM Megamall",
      "SM North EDSA"
    ]);
  });

  it("falls back to canonical name lookup when no alias matches", async () => {
    const placesSelect = vi.fn().mockReturnValue({
      ilike: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: "place-1",
              canonical_name: "PUP Sta. Mesa",
              city: "Manila",
              kind: "campus",
              latitude: 14.5987,
              longitude: 121.0109,
              google_place_id: null,
              created_at: "2026-03-19T10:05:00.000Z"
            }
          ],
          error: null
        })
      })
    });
    const aliasesSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null
      })
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "place_aliases") {
          return {
            select: aliasesSelect
          };
        }

        if (table === "places") {
          return {
            select: placesSelect
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const result = await resolvePlaceReference({
      query: "PUP Sta Mesa"
    });

    expect(result).toEqual({
      status: "resolved",
      place: {
        id: "place-1",
        canonicalName: "PUP Sta. Mesa",
        city: "Manila",
        kind: "campus",
        latitude: 14.5987,
        longitude: 121.0109,
        googlePlaceId: null,
        createdAt: "2026-03-19T10:05:00.000Z",
        matchedBy: "canonicalName",
        matchedText: "PUP Sta. Mesa"
      }
    });
  });

  it("returns unresolved when the place cannot be matched", async () => {
    const placesSelect = vi.fn().mockReturnValue({
      ilike: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })
    });
    const aliasesSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null
      })
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "place_aliases") {
          return {
            select: aliasesSelect
          };
        }

        if (table === "places") {
          return {
            select: placesSelect
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const result = await resolvePlaceReference({
      query: "Unknown terminal"
    });

    expect(result).toEqual({
      status: "unresolved"
    });
  });
});
