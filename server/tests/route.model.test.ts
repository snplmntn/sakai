import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import {
  getRouteMetadataByVariantIds,
  listActiveRouteVariants
} from "../src/models/route.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("route model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active route metadata for a set of variant ids", async () => {
    const routeVariantsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: "variant-1",
          route_id: "route-1",
          display_name: "Cubao to PUP",
          direction_label: "Eastbound",
          origin_place_id: "place-1",
          destination_place_id: "place-2",
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const routeVariantsEq = vi.fn().mockReturnValue({
      in: routeVariantsIn
    });
    const routesEq = vi.fn().mockResolvedValue({
      data: [
        {
          id: "route-1",
          code: "JEEP-CUBAO-PUP",
          display_name: "Cubao - PUP",
          primary_mode: "jeepney",
          operator_name: null,
          source_name: "trusted-import",
          source_url: null,
          trust_level: "trusted_seed",
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "route_variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: routeVariantsEq
            })
          };
        }

        if (table === "routes") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: routesEq
              })
            })
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const routes = await getRouteMetadataByVariantIds(["variant-1"]);

    expect(routes).toEqual([
      {
        id: "route-1",
        code: "JEEP-CUBAO-PUP",
        displayName: "Cubao - PUP",
        primaryMode: "jeepney",
        operatorName: null,
        sourceName: "trusted-import",
        sourceUrl: null,
        trustLevel: "trusted_seed",
        isActive: true,
        createdAt: "2026-03-19T10:05:00.000Z"
      }
    ]);
  });

  it("loads route variants with ordered legs and stop details", async () => {
    const routeVariantsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: "variant-1",
          route_id: "route-1",
          display_name: "Cubao to PUP",
          direction_label: "Eastbound",
          origin_place_id: "place-1",
          destination_place_id: "place-2",
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const routeVariantsEq = vi.fn().mockReturnValue({
      in: routeVariantsIn
    });
    const routesEq = vi.fn().mockResolvedValue({
      data: [
        {
          id: "route-1",
          code: "JEEP-CUBAO-PUP",
          display_name: "Cubao - PUP",
          primary_mode: "jeepney",
          operator_name: null,
          source_name: "trusted-import",
          source_url: null,
          trust_level: "trusted_seed",
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const routeLegsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: "leg-2",
          route_variant_id: "variant-1",
          sequence: 2,
          mode: "jeepney",
          from_stop_id: "stop-2",
          to_stop_id: "stop-3",
          route_label: "V. Mapa to Teresa",
          distance_km: 2.4,
          duration_minutes: 12,
          fare_product_code: null,
          corridor_tag: "sta-mesa",
          created_at: "2026-03-19T10:05:00.000Z"
        },
        {
          id: "leg-1",
          route_variant_id: "variant-1",
          sequence: 1,
          mode: "jeepney",
          from_stop_id: "stop-1",
          to_stop_id: "stop-2",
          route_label: "Cubao to V. Mapa",
          distance_km: 5.7,
          duration_minutes: 20,
          fare_product_code: null,
          corridor_tag: "cubao-sta-mesa",
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const stopsEq = vi.fn().mockResolvedValue({
      data: [
        {
          id: "stop-1",
          place_id: "place-1",
          stop_name: "Cubao Terminal",
          mode: "jeepney",
          area: "Cubao",
          latitude: 14.619,
          longitude: 121.053,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        },
        {
          id: "stop-2",
          place_id: null,
          stop_name: "V. Mapa Stop",
          mode: "jeepney",
          area: "Sta. Mesa",
          latitude: 14.604,
          longitude: 121.018,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        },
        {
          id: "stop-3",
          place_id: "place-2",
          stop_name: "PUP Main Gate",
          mode: "jeepney",
          area: "Sta. Mesa",
          latitude: 14.5987,
          longitude: 121.0109,
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "route_variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: routeVariantsEq
            })
          };
        }

        if (table === "routes") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: routesEq
              })
            })
          };
        }

        if (table === "route_legs") {
          return {
            select: vi.fn().mockReturnValue({
              in: routeLegsIn
            })
          };
        }

        if (table === "stops") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: stopsEq
              })
            })
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const variants = await listActiveRouteVariants({
      variantIds: ["variant-1"]
    });

    expect(variants).toHaveLength(1);
    expect(variants[0].legs.map((leg) => leg.sequence)).toEqual([1, 2]);
    expect(variants[0].legs[0].fromStop.stopName).toBe("Cubao Terminal");
    expect(variants[0].route.code).toBe("JEEP-CUBAO-PUP");
  });

  it("throws when an active variant points to a missing active route", async () => {
    const routeVariantsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: "variant-1",
          route_id: "route-missing",
          display_name: "Broken Variant",
          direction_label: "Eastbound",
          origin_place_id: "place-1",
          destination_place_id: "place-2",
          is_active: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const routeVariantsEq = vi.fn().mockReturnValue({
      in: routeVariantsIn
    });
    const routesEq = vi.fn().mockResolvedValue({
      data: [],
      error: null
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "route_variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: routeVariantsEq
            })
          };
        }

        if (table === "routes") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: routesEq
              })
            })
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    await expect(
      listActiveRouteVariants({
        variantIds: ["variant-1"]
      })
    ).rejects.toThrowError("Active route variant references missing active route route-missing");
  });
});
