import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculateRouteFare } from "../src/services/fare-engine.service.js";
import type { CalculateRouteFareOptions } from "../src/services/fare-engine.service.js";

const createDataSource = (
  overrides: Partial<NonNullable<CalculateRouteFareOptions["dataSource"]>> = {}
): NonNullable<CalculateRouteFareOptions["dataSource"]> => ({
  getActiveFareRuleVersionsByModes: vi.fn().mockResolvedValue([]),
  getFareProductsByVersionIdsAndCodes: vi.fn().mockResolvedValue([]),
  getTrainStationFaresByVersionIdsAndPairs: vi.fn().mockResolvedValue([]),
  ...overrides
});

describe("fare engine service", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prices traditional PUJ segments for regular and discounted passengers", async () => {
    const dataSource = createDataSource({
      getActiveFareRuleVersionsByModes: vi.fn().mockResolvedValue([
        {
          id: "version-jeep",
          mode: "jeepney",
          versionName: "LTFRB PUJ 2026",
          sourceName: "LTFRB",
          sourceUrl: "https://example.com/puj",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ]),
      getFareProductsByVersionIdsAndCodes: vi.fn().mockResolvedValue([
        {
          id: "product-jeep",
          fareRuleVersionId: "version-jeep",
          productCode: "puj_traditional",
          mode: "jeepney",
          pricingStrategy: "minimum_plus_succeeding",
          vehicleClass: "traditional",
          minimumDistanceKm: 4,
          minimumFareRegular: 13,
          minimumFareDiscounted: 10.4,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 1.8,
          succeedingFareDiscounted: 1.44,
          notes: null,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ])
    });
    const baseOptions = {
      now: new Date("2026-03-19T10:05:00.000Z"),
      dataSource,
      segments: [
        {
          kind: "ride_leg" as const,
          id: "leg-1",
          mode: "jeepney" as const,
          routeLabel: "Cubao to V. Mapa",
          distanceKm: 5.7,
          fareProductCode: "puj_traditional",
          fromStopId: "stop-1",
          toStopId: "stop-2"
        }
      ]
    };

    const regular = await calculateRouteFare({
      ...baseOptions,
      passengerType: "regular"
    });
    const discounted = await calculateRouteFare({
      ...baseOptions,
      passengerType: "student"
    });

    expect(regular).toMatchObject({
      status: "priced",
      totalFare: 16.6,
      fareConfidence: "official"
    });
    expect(discounted).toMatchObject({
      status: "priced",
      totalFare: 13.28,
      fareConfidence: "official"
    });
  });

  it("prices UV per kilometer and keeps walking transfers free", async () => {
    const dataSource = createDataSource({
      getActiveFareRuleVersionsByModes: vi.fn().mockResolvedValue([
        {
          id: "version-uv",
          mode: "uv",
          versionName: "LTFRB UV 2026",
          sourceName: "LTFRB",
          sourceUrl: "https://example.com/uv",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ]),
      getFareProductsByVersionIdsAndCodes: vi.fn().mockResolvedValue([
        {
          id: "product-uv",
          fareRuleVersionId: "version-uv",
          productCode: "uv_traditional",
          mode: "uv",
          pricingStrategy: "per_km",
          vehicleClass: "traditional",
          minimumDistanceKm: 0,
          minimumFareRegular: 0,
          minimumFareDiscounted: 0,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 2.4,
          succeedingFareDiscounted: 1.92,
          notes: null,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ])
    });

    const result = await calculateRouteFare({
      segments: [
        {
          kind: "ride_leg",
          id: "leg-uv",
          mode: "uv",
          routeLabel: "Ortigas to Ayala",
          distanceKm: 7.5,
          fareProductCode: "uv_traditional",
          fromStopId: "stop-1",
          toStopId: "stop-2"
        },
        {
          kind: "transfer_walk",
          id: "walk-1",
          description: "Walk to destination",
          walkingDistanceM: 250,
          walkingDurationMinutes: 4
        }
      ],
      passengerType: "regular",
      now: new Date("2026-03-19T10:05:00.000Z"),
      dataSource
    });

    expect(result).toMatchObject({
      status: "priced",
      totalFare: 18,
      fareConfidence: "official"
    });
    expect(result.status === "priced" ? result.segments[1].amount : null).toBe(0);
  });

  it("prices train fares from stored station tables and reports stale versions", async () => {
    const dataSource = createDataSource({
      getActiveFareRuleVersionsByModes: vi.fn().mockResolvedValue([
        {
          id: "version-lrt2",
          mode: "lrt2",
          versionName: "LRT-2 2025",
          sourceName: "LRTA",
          sourceUrl: "https://example.com/lrt2",
          effectivityDate: "2025-01-01",
          verifiedAt: "2025-01-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2025-01-01T00:00:00.000Z"
        }
      ]),
      getTrainStationFaresByVersionIdsAndPairs: vi.fn().mockResolvedValue([
        {
          id: "fare-train",
          fareRuleVersionId: "version-lrt2",
          originStopId: "stop-a",
          destinationStopId: "stop-b",
          regularFare: 20,
          discountedFare: 16,
          createdAt: "2025-01-01T00:00:00.000Z"
        }
      ])
    });

    const result = await calculateRouteFare({
      segments: [
        {
          kind: "ride_leg",
          id: "leg-train",
          mode: "lrt2",
          routeLabel: "Cubao to V. Mapa",
          distanceKm: 0,
          fareProductCode: null,
          fromStopId: "stop-a",
          toStopId: "stop-b"
        }
      ],
      passengerType: "senior",
      now: new Date("2026-03-19T10:05:00.000Z"),
      dataSource
    });

    expect(result).toMatchObject({
      status: "priced",
      totalFare: 16,
      fareConfidence: "official"
    });
    expect(result.status === "priced" ? result.fareAssumptions[0] : null).toContain("stale");
  });

  it("returns an unpriceable result when a priceable ride leg has no fare product code", async () => {
    const dataSource = createDataSource({
      getActiveFareRuleVersionsByModes: vi.fn().mockResolvedValue([
        {
          id: "version-jeep",
          mode: "jeepney",
          versionName: "LTFRB PUJ 2026",
          sourceName: "LTFRB",
          sourceUrl: "https://example.com/puj",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ])
    });

    const result = await calculateRouteFare({
      segments: [
        {
          kind: "ride_leg",
          id: "leg-1",
          mode: "jeepney",
          routeLabel: "Cubao to PUP",
          distanceKm: 5,
          fareProductCode: null,
          fromStopId: "stop-1",
          toStopId: "stop-2"
        }
      ],
      passengerType: "regular",
      now: new Date("2026-03-19T10:05:00.000Z"),
      dataSource
    });

    expect(result).toMatchObject({
      status: "unpriceable",
      unresolvedSegmentId: "leg-1",
      reasonCode: "missing_fare_product_code"
    });
  });

  it("marks routes partially estimated when car legs are included", async () => {
    const dataSource = createDataSource({
      getActiveFareRuleVersionsByModes: vi.fn().mockResolvedValue([
        {
          id: "version-jeep",
          mode: "jeepney",
          versionName: "LTFRB PUJ 2026",
          sourceName: "LTFRB",
          sourceUrl: "https://example.com/puj",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2026-03-01T00:00:00.000Z"
        },
        {
          id: "version-car",
          mode: "car",
          versionName: "Car estimate 2026",
          sourceName: "Sakai",
          sourceUrl: "https://example.com/car",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "estimated",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ]),
      getFareProductsByVersionIdsAndCodes: vi.fn().mockResolvedValue([
        {
          id: "product-jeep",
          fareRuleVersionId: "version-jeep",
          productCode: "puj_modern_non_aircon",
          mode: "jeepney",
          pricingStrategy: "minimum_plus_succeeding",
          vehicleClass: "modern_non_aircon",
          minimumDistanceKm: 4,
          minimumFareRegular: 15,
          minimumFareDiscounted: 12,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 1.8,
          succeedingFareDiscounted: 1.44,
          notes: null,
          createdAt: "2026-03-01T00:00:00.000Z"
        },
        {
          id: "product-car",
          fareRuleVersionId: "version-car",
          productCode: "car_estimated",
          mode: "car",
          pricingStrategy: "per_km",
          vehicleClass: "sedan",
          minimumDistanceKm: 0,
          minimumFareRegular: 0,
          minimumFareDiscounted: null,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 12,
          succeedingFareDiscounted: null,
          notes: "Car costs are estimates only.",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ])
    });

    const result = await calculateRouteFare({
      segments: [
        {
          kind: "ride_leg",
          id: "leg-jeep",
          mode: "jeepney",
          routeLabel: "PUP to V. Mapa",
          distanceKm: 4,
          fareProductCode: "puj_modern_non_aircon",
          fromStopId: "stop-1",
          toStopId: "stop-2"
        },
        {
          kind: "car_leg",
          id: "leg-car",
          routeLabel: "Last mile car",
          distanceKm: 1.5,
          fareProductCode: "car_estimated"
        }
      ],
      passengerType: "regular",
      now: new Date("2026-03-19T10:05:00.000Z"),
      dataSource
    });

    expect(result).toMatchObject({
      status: "priced",
      fareConfidence: "partially_estimated",
      totalFare: 33
    });
  });
});
