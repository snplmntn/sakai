import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/fare.model.js", () => ({
  getActiveFareCatalog: vi.fn()
}));

import * as fareModel from "../src/models/fare.model.js";
import { priceRideLegs } from "../src/services/fare-engine.service.js";

const mockedFareModel = vi.mocked(fareModel);

describe("fare engine service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("prices traditional jeepney rides deterministically", async () => {
    mockedFareModel.getActiveFareCatalog.mockResolvedValue({
      ruleVersions: [
        {
          id: "rule-jeepney",
          mode: "jeepney",
          versionName: "LTFRB 2026",
          sourceName: "LTFRB",
          sourceUrl: "https://ltfrb.gov.ph",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      fareProducts: [
        {
          id: "product-1",
          fareRuleVersionId: "rule-jeepney",
          productCode: "puj_traditional",
          mode: "jeepney",
          pricingStrategy: "minimum_plus_succeeding",
          vehicleClass: "traditional",
          minimumDistanceKm: 4,
          minimumFareRegular: 13,
          minimumFareDiscounted: 13,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 1.8,
          succeedingFareDiscounted: 1.44,
          notes: null,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      trainStationFares: []
    });

    const result = await priceRideLegs(
      [
        {
          id: "ride-1",
          mode: "jeepney",
          distanceKm: 5.7,
          fareProductCode: "puj_traditional",
          fromStopId: "stop-1",
          toStopId: "stop-2"
        }
      ],
      "regular"
    );

    expect(result.totalFare).toBe(16.6);
    expect(result.fareConfidence).toBe("official");
    expect(result.rideLegs[0]?.fare.amount).toBe(16.6);
  });

  it("prices discounted traditional jeepney rides with the shared base fare", async () => {
    mockedFareModel.getActiveFareCatalog.mockResolvedValue({
      ruleVersions: [
        {
          id: "rule-jeepney",
          mode: "jeepney",
          versionName: "LTFRB 2026",
          sourceName: "LTFRB",
          sourceUrl: "https://ltfrb.gov.ph",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      fareProducts: [
        {
          id: "product-1",
          fareRuleVersionId: "rule-jeepney",
          productCode: "puj_traditional",
          mode: "jeepney",
          pricingStrategy: "minimum_plus_succeeding",
          vehicleClass: "traditional",
          minimumDistanceKm: 4,
          minimumFareRegular: 13,
          minimumFareDiscounted: 13,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 1.8,
          succeedingFareDiscounted: 1.44,
          notes: null,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      trainStationFares: []
    });

    const result = await priceRideLegs(
      [
        {
          id: "ride-1",
          mode: "jeepney",
          distanceKm: 5.2,
          fareProductCode: "puj_traditional",
          fromStopId: "stop-1",
          toStopId: "stop-2"
        }
      ],
      "student"
    );

    expect(result.totalFare).toBe(15.88);
    expect(result.fareConfidence).toBe("official");
    expect(result.rideLegs[0]?.fare.amount).toBe(15.88);
    expect(result.rideLegs[0]?.fare.isDiscountApplied).toBe(true);
  });

  it("falls back to regular fare when discounted fare is unavailable", async () => {
    mockedFareModel.getActiveFareCatalog.mockResolvedValue({
      ruleVersions: [
        {
          id: "rule-uv",
          mode: "uv",
          versionName: "UV Demo",
          sourceName: "Demo",
          sourceUrl: "https://example.com",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "estimated",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      fareProducts: [
        {
          id: "product-1",
          fareRuleVersionId: "rule-uv",
          productCode: "uv_traditional",
          mode: "uv",
          pricingStrategy: "per_km",
          vehicleClass: "traditional",
          minimumDistanceKm: 0,
          minimumFareRegular: 0,
          minimumFareDiscounted: null,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 2.4,
          succeedingFareDiscounted: null,
          notes: null,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      trainStationFares: []
    });

    const result = await priceRideLegs(
      [
        {
          id: "ride-1",
          mode: "uv",
          distanceKm: 10,
          fareProductCode: "uv_traditional",
          fromStopId: "stop-1",
          toStopId: "stop-2"
        }
      ],
      "student"
    );

    expect(result.totalFare).toBe(24);
    expect(result.fareConfidence).toBe("estimated");
    expect(result.fareAssumptions).toContain(
      "Discounted fare unavailable for student; used regular fare"
    );
  });

  it("uses train fares with reverse-direction lookup when needed", async () => {
    mockedFareModel.getActiveFareCatalog.mockResolvedValue({
      ruleVersions: [
        {
          id: "rule-lrt2",
          mode: "lrt2",
          versionName: "LRT-2 2026",
          sourceName: "LRTA",
          sourceUrl: "https://example.com",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      fareProducts: [],
      trainStationFares: [
        {
          id: "train-fare-1",
          fareRuleVersionId: "rule-lrt2",
          originStopId: "recto",
          destinationStopId: "cubao",
          regularFare: 20,
          discountedFare: 16,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ]
    });

    const result = await priceRideLegs(
      [
        {
          id: "ride-1",
          mode: "lrt2",
          distanceKm: 0,
          fareProductCode: null,
          fromStopId: "cubao",
          toStopId: "recto"
        }
      ],
      "student"
    );

    expect(result.totalFare).toBe(16);
    expect(result.fareConfidence).toBe("official");
    expect(result.rideLegs[0]?.fare.isDiscountApplied).toBe(true);
  });

  it("marks formula-seeded train fares as estimated when the active train ruleset is estimated", async () => {
    mockedFareModel.getActiveFareCatalog.mockResolvedValue({
      ruleVersions: [
        {
          id: "rule-lrt1",
          mode: "lrt1",
          versionName: "Sakai LRT-1 Estimated Station-Step Baseline 2026",
          sourceName: "Sakai estimated station-count baseline",
          sourceUrl: "https://lrmc.ph",
          effectivityDate: "2026-03-20",
          verifiedAt: "2026-03-20T00:00:00.000Z",
          isActive: true,
          trustLevel: "estimated",
          createdAt: "2026-03-20T00:00:00.000Z"
        }
      ],
      fareProducts: [],
      trainStationFares: [
        {
          id: "train-fare-1",
          fareRuleVersionId: "rule-lrt1",
          originStopId: "baclaran",
          destinationStopId: "edsa",
          regularFare: 20,
          discountedFare: 10,
          createdAt: "2026-03-20T00:00:00.000Z"
        }
      ]
    });

    const result = await priceRideLegs(
      [
        {
          id: "ride-1",
          mode: "lrt1",
          distanceKm: 0,
          fareProductCode: null,
          fromStopId: "baclaran",
          toStopId: "edsa"
        }
      ],
      "senior"
    );

    expect(result.totalFare).toBe(10);
    expect(result.fareConfidence).toBe("estimated");
    expect(result.rideLegs[0]?.fare.pricingType).toBe("estimated");
    expect(result.rideLegs[0]?.fare.isDiscountApplied).toBe(true);
  });

  it("adds stale fare assumptions when the active ruleset is old", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T00:00:00.000Z"));
    mockedFareModel.getActiveFareCatalog.mockResolvedValue({
      ruleVersions: [
        {
          id: "rule-jeepney",
          mode: "jeepney",
          versionName: "LTFRB 2024",
          sourceName: "LTFRB",
          sourceUrl: "https://ltfrb.gov.ph",
          effectivityDate: "2024-01-01",
          verifiedAt: "2024-01-15T00:00:00.000Z",
          isActive: true,
          trustLevel: "official",
          createdAt: "2024-01-15T00:00:00.000Z"
        }
      ],
      fareProducts: [
        {
          id: "product-1",
          fareRuleVersionId: "rule-jeepney",
          productCode: "puj_traditional",
          mode: "jeepney",
          pricingStrategy: "minimum_plus_succeeding",
          vehicleClass: "traditional",
          minimumDistanceKm: 4,
          minimumFareRegular: 13,
          minimumFareDiscounted: 13,
          succeedingDistanceKm: 1,
          succeedingFareRegular: 1.8,
          succeedingFareDiscounted: 1.44,
          notes: null,
          createdAt: "2024-01-15T00:00:00.000Z"
        }
      ],
      trainStationFares: []
    });

    const result = await priceRideLegs(
      [
        {
          id: "ride-1",
          mode: "jeepney",
          distanceKm: 4,
          fareProductCode: "puj_traditional",
          fromStopId: "stop-1",
          toStopId: "stop-2"
        }
      ],
      "regular"
    );

    expect(result.fareAssumptions).toContain("Fare ruleset LTFRB 2024 may be stale");
  });
});
