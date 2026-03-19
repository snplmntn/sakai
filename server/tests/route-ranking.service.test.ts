import { describe, expect, it } from "vitest";

import { rankRouteOptions } from "../src/services/route-ranking.service.js";
import type { RouteQueryOption } from "../src/types/route-query.js";

const createOption = (overrides: Partial<RouteQueryOption>): RouteQueryOption => ({
  id: overrides.id ?? "option-1",
  summary: overrides.summary ?? "Route summary",
  recommendationLabel: overrides.recommendationLabel ?? "Alternative option",
  highlights: overrides.highlights ?? [],
  totalDurationMinutes: overrides.totalDurationMinutes ?? 40,
  totalFare: overrides.totalFare ?? 20,
  fareConfidence: overrides.fareConfidence ?? "official",
  transferCount: overrides.transferCount ?? 1,
  corridorTags: overrides.corridorTags ?? ["cubao"],
  fareAssumptions: overrides.fareAssumptions ?? [],
  legs: overrides.legs ?? [],
  relevantIncidents: []
});

describe("route ranking service", () => {
  it("ranks fastest routes by duration then fare then transfers", () => {
    const ranked = rankRouteOptions(
      [
        createOption({
          id: "slow-cheap",
          totalDurationMinutes: 50,
          totalFare: 10
        }),
        createOption({
          id: "fast",
          totalDurationMinutes: 30,
          totalFare: 25
        }),
        createOption({
          id: "fast-cheaper",
          totalDurationMinutes: 30,
          totalFare: 15
        })
      ],
      "fastest"
    );

    expect(ranked.map((option) => option.id)).toEqual(["fast-cheaper", "fast", "slow-cheap"]);
    expect(ranked[0]?.recommendationLabel).toBe("Fastest option");
  });

  it("ranks cheapest routes by fare then duration then transfers", () => {
    const ranked = rankRouteOptions(
      [
        createOption({
          id: "cheap-slow",
          totalDurationMinutes: 60,
          totalFare: 15
        }),
        createOption({
          id: "cheap-fast",
          totalDurationMinutes: 40,
          totalFare: 15
        }),
        createOption({
          id: "expensive",
          totalDurationMinutes: 20,
          totalFare: 25
        })
      ],
      "cheapest"
    );

    expect(ranked.map((option) => option.id)).toEqual(["cheap-fast", "cheap-slow", "expensive"]);
    expect(ranked[0]?.recommendationLabel).toBe("Cheapest option");
  });

  it("adds secondary labels only when they are uniquely true", () => {
    const ranked = rankRouteOptions(
      [
        createOption({
          id: "balanced",
          totalDurationMinutes: 35,
          totalFare: 18,
          transferCount: 1,
          legs: [
            {
              type: "ride",
              id: "ride-1",
              mode: "jeepney",
              routeId: "route-1",
              routeVariantId: "variant-1",
              routeCode: "J1",
              routeName: "Jeep 1",
              directionLabel: "Eastbound",
              fromStop: {
                id: "stop-1",
                placeId: null,
                externalStopCode: null,
                stopName: "Stop 1",
                mode: "jeepney",
                area: "Cubao",
                latitude: 0,
                longitude: 0,
                isActive: true,
                createdAt: "2026-03-19T00:00:00.000Z"
              },
              toStop: {
                id: "stop-2",
                placeId: null,
                externalStopCode: null,
                stopName: "Stop 2",
                mode: "jeepney",
                area: "Cubao",
                latitude: 0,
                longitude: 0,
                isActive: true,
                createdAt: "2026-03-19T00:00:00.000Z"
              },
              routeLabel: "Jeep 1",
              distanceKm: 5,
              durationMinutes: 20,
              corridorTags: ["cubao"],
              fare: {
                amount: 13,
                pricingType: "official",
                fareProductCode: "puj_traditional",
                ruleVersionName: "LTFRB",
                effectivityDate: "2026-01-01",
                isDiscountApplied: false,
                assumptionText: null
              }
            }
          ]
        }),
        createOption({
          id: "many-transfers",
          totalDurationMinutes: 36,
          totalFare: 19,
          transferCount: 2
        })
      ],
      "balanced"
    );

    expect(ranked[0]?.recommendationLabel).toBe("Balanced option");
    expect(ranked[0]?.highlights).toContain("Fewest transfers");
    expect(ranked[0]?.highlights).toContain("Most jeepney-friendly");
  });
});
