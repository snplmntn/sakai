import { describe, expect, it } from "vitest";

import { rankRouteOptions } from "../src/services/route-ranking.service.js";
import type { RouteQueryOption } from "../src/types/route-query.js";

const createOption = (input: {
  id: string;
  totalDurationMinutes: number;
  totalFare: number;
  transferCount: number;
  jeepneyRideCount: number;
  walkingDistanceMeters: number;
  walkingDurationMinutes: number;
}): RouteQueryOption => ({
  id: input.id,
  summary: "",
  recommendationLabel: "Alternative option",
  highlights: [],
  totalDurationMinutes: input.totalDurationMinutes,
  totalFare: input.totalFare,
  fareConfidence: "official",
  transferCount: input.transferCount,
  corridorTags: [],
  fareAssumptions: [],
  legs: [
    ...Array.from({ length: input.jeepneyRideCount }, (_, index) => ({
      type: "ride" as const,
      id: `${input.id}:jeep:${index}`,
      mode: "jeepney" as const,
      routeId: `route-${input.id}-${index}`,
      routeVariantId: `variant-${input.id}-${index}`,
      routeCode: `JEEP-${input.id}-${index}`,
      routeName: `Jeep option ${input.id}`,
      directionLabel: "Outbound",
      fromStop: {
        id: `${input.id}:from:${index}`,
        placeId: null,
        externalStopCode: null,
        stopName: "Origin",
        mode: "jeepney" as const,
        area: "Metro Manila",
        latitude: 14.6,
        longitude: 121,
        isActive: true,
        createdAt: "2026-03-20T00:00:00.000Z"
      },
      toStop: {
        id: `${input.id}:to:${index}`,
        placeId: null,
        externalStopCode: null,
        stopName: "Destination",
        mode: "jeepney" as const,
        area: "Metro Manila",
        latitude: 14.61,
        longitude: 121.01,
        isActive: true,
        createdAt: "2026-03-20T00:00:00.000Z"
      },
      routeLabel: "Jeep route",
      distanceKm: 4,
      durationMinutes: 12,
      corridorTags: [],
      fare: {
        amount: 13,
        pricingType: "official" as const,
        fareProductCode: "puj_traditional",
        ruleVersionName: "LTFRB",
        effectivityDate: "2026-01-01",
        isDiscountApplied: false,
        assumptionText: null
      }
    })),
    ...(input.walkingDistanceMeters > 0
      ? [
          {
            type: "walk" as const,
            id: `${input.id}:walk`,
            fromLabel: "Transfer",
            toLabel: "Destination",
            distanceMeters: input.walkingDistanceMeters,
            durationMinutes: input.walkingDurationMinutes,
            fare: {
              amount: 0,
              pricingType: "official" as const,
              fareProductCode: null,
              ruleVersionName: null,
              effectivityDate: null,
              isDiscountApplied: false,
              assumptionText: null
            }
          },
        ]
      : []),
  ],
  relevantIncidents: [],
  source: "sakai",
  navigationTarget: {
    latitude: 14.61,
    longitude: 121.01,
    label: "Destination",
    kind: "dropoff_stop"
  }
});

describe("route ranking service", () => {
  it("prioritizes jeepney-serving options when jeep_if_possible is active", () => {
    const ranked = rankRouteOptions(
      [
        createOption({
          id: "non-jeep",
          totalDurationMinutes: 24,
          totalFare: 18,
          transferCount: 0,
          jeepneyRideCount: 0,
          walkingDistanceMeters: 40,
          walkingDurationMinutes: 1
        }),
        createOption({
          id: "jeep",
          totalDurationMinutes: 30,
          totalFare: 20,
          transferCount: 1,
          jeepneyRideCount: 1,
          walkingDistanceMeters: 80,
          walkingDurationMinutes: 2
        })
      ],
      "fastest",
      ["jeep_if_possible"]
    );

    expect(ranked[0]?.id).toBe("jeep");
  });

  it("prioritizes lower walking distance when less_walking is active", () => {
    const ranked = rankRouteOptions(
      [
        createOption({
          id: "short-walk",
          totalDurationMinutes: 29,
          totalFare: 18,
          transferCount: 1,
          jeepneyRideCount: 1,
          walkingDistanceMeters: 50,
          walkingDurationMinutes: 1
        }),
        createOption({
          id: "long-walk",
          totalDurationMinutes: 24,
          totalFare: 16,
          transferCount: 0,
          jeepneyRideCount: 1,
          walkingDistanceMeters: 300,
          walkingDurationMinutes: 5
        })
      ],
      "cheapest",
      ["less_walking"]
    );

    expect(ranked[0]?.id).toBe("short-walk");
  });

  it("falls back to base preference ordering when no modifier applies", () => {
    const ranked = rankRouteOptions(
      [
        createOption({
          id: "faster",
          totalDurationMinutes: 20,
          totalFare: 30,
          transferCount: 1,
          jeepneyRideCount: 0,
          walkingDistanceMeters: 0,
          walkingDurationMinutes: 0
        }),
        createOption({
          id: "slower",
          totalDurationMinutes: 28,
          totalFare: 20,
          transferCount: 0,
          jeepneyRideCount: 0,
          walkingDistanceMeters: 0,
          walkingDurationMinutes: 0
        })
      ],
      "fastest",
      ["jeep_if_possible"]
    );

    expect(ranked[0]?.id).toBe("faster");
  });
});
