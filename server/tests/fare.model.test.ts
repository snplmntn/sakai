import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

vi.mock("../src/models/stop.model.js", () => ({
  getStopsByIds: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import { getStopsByIds } from "../src/models/stop.model.js";
import {
  getActiveFareRuleVersionsByModes,
  getFareProductsByVersionIdsAndCodes,
  getTrainStationFaresByVersionIdsAndPairs
} from "../src/models/fare.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedGetStopsByIds = vi.mocked(getStopsByIds);

describe("fare model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads active fare rule versions by mode in deterministic order", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          id: "version-2",
          mode: "uv",
          version_name: "UV 2026",
          source_name: "LTFRB",
          source_url: "https://example.com/uv",
          effectivity_date: "2026-01-01",
          verified_at: "2026-03-19T10:05:00.000Z",
          is_active: true,
          trust_level: "official",
          created_at: "2026-03-19T10:05:00.000Z"
        },
        {
          id: "version-1",
          mode: "jeepney",
          version_name: "PUJ 2026",
          source_name: "LTFRB",
          source_url: "https://example.com/puj",
          effectivity_date: "2026-01-01",
          verified_at: "2026-03-19T10:05:00.000Z",
          is_active: true,
          trust_level: "official",
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq
          })
        })
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const versions = await getActiveFareRuleVersionsByModes(["uv", "jeepney"]);

    expect(versions.map((version) => version.mode)).toEqual(["jeepney", "uv"]);
  });

  it("loads fare products scoped by version id and product code", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "product-1",
                  fare_rule_version_id: "version-1",
                  product_code: "puj_traditional",
                  mode: "jeepney",
                  pricing_strategy: "minimum_plus_succeeding",
                  vehicle_class: "traditional",
                  minimum_distance_km: 4,
                  minimum_fare_regular: 13,
                  minimum_fare_discounted: 10.4,
                  succeeding_distance_km: 1,
                  succeeding_fare_regular: 1.8,
                  succeeding_fare_discounted: 1.44,
                  notes: null,
                  created_at: "2026-03-19T10:05:00.000Z"
                }
              ],
              error: null
            })
          })
        })
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const products = await getFareProductsByVersionIdsAndCodes({
      fareRuleVersionIds: ["version-1"],
      productCodes: ["puj_traditional"]
    });

    expect(products).toEqual([
      expect.objectContaining({
        fareRuleVersionId: "version-1",
        productCode: "puj_traditional",
        pricingStrategy: "minimum_plus_succeeding"
      })
    ]);
  });

  it("loads train station fares for validated train stops only", async () => {
    mockedGetStopsByIds.mockResolvedValue([
      {
        id: "stop-a",
        placeId: null,
        stopName: "Araneta Center-Cubao",
        mode: "lrt2",
        area: "Cubao",
        latitude: 14.62,
        longitude: 121.05,
        isActive: true,
        createdAt: "2026-03-19T10:05:00.000Z"
      },
      {
        id: "stop-b",
        placeId: null,
        stopName: "V. Mapa",
        mode: "lrt2",
        area: "Sta. Mesa",
        latitude: 14.6,
        longitude: 121.01,
        isActive: true,
        createdAt: "2026-03-19T10:05:00.000Z"
      }
    ]);
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "fare-1",
                    fare_rule_version_id: "version-1",
                    origin_stop_id: "stop-a",
                    destination_stop_id: "stop-b",
                    regular_fare: 20,
                    discounted_fare: 16,
                    created_at: "2026-03-19T10:05:00.000Z"
                  }
                ],
                error: null
              })
            })
          })
        })
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const fares = await getTrainStationFaresByVersionIdsAndPairs({
      fareRuleVersionIds: ["version-1"],
      stopPairs: [
        {
          originStopId: "stop-a",
          destinationStopId: "stop-b"
        }
      ]
    });

    expect(fares).toEqual([
      expect.objectContaining({
        fareRuleVersionId: "version-1",
        originStopId: "stop-a",
        destinationStopId: "stop-b"
      })
    ]);
  });

  it("rejects train fare lookups that reference non-train stop modes", async () => {
    mockedGetStopsByIds.mockResolvedValue([
      {
        id: "stop-a",
        placeId: null,
        stopName: "Cubao Terminal",
        mode: "jeepney",
        area: "Cubao",
        latitude: 14.62,
        longitude: 121.05,
        isActive: true,
        createdAt: "2026-03-19T10:05:00.000Z"
      }
    ]);

    await expect(
      getTrainStationFaresByVersionIdsAndPairs({
        fareRuleVersionIds: ["version-1"],
        stopPairs: [
          {
            originStopId: "stop-a",
            destinationStopId: "stop-a"
          }
        ]
      })
    ).rejects.toThrowError("Train station fare lookup requires train stop modes");
  });
});
