import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ai/client.js", () => ({
  generateJson: vi.fn(),
  getLightModel: vi.fn(() => "gemini-2.5-flash-lite"),
  isAiEnabled: vi.fn(() => true),
  AiUnavailableError: class AiUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AiUnavailableError";
    }
  },
  AiInvalidResponseError: class AiInvalidResponseError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AiInvalidResponseError";
    }
  }
}));

import * as aiClient from "../src/ai/client.js";
import {
  buildTemplateRouteSummary,
  generateRouteSummary
} from "../src/ai/route-summary.js";
import type { RouteQueryOption } from "../src/types/route-query.js";

const mockedAiClient = vi.mocked(aiClient);

const routeOption: RouteQueryOption = {
  id: "option-1",
  summary: "",
  recommendationLabel: "Balanced option",
  highlights: [],
  totalDurationMinutes: 35,
  totalFare: 24,
  fareConfidence: "official",
  transferCount: 1,
  corridorTags: ["cubao", "sta-mesa"],
  fareAssumptions: [],
  legs: [
    {
      type: "ride",
      id: "ride-1",
      mode: "jeepney",
      routeId: "route-1",
      routeVariantId: "variant-1",
      routeCode: "J1",
      routeName: "Cubao - PUP",
      directionLabel: "Eastbound",
      fromStop: {
        id: "stop-1",
        placeId: null,
        externalStopCode: null,
        stopName: "Cubao Terminal",
        mode: "jeepney",
        area: "Cubao",
        latitude: 14.6,
        longitude: 121.0,
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z"
      },
      toStop: {
        id: "stop-2",
        placeId: null,
        externalStopCode: null,
        stopName: "PUP Main Gate",
        mode: "jeepney",
        area: "Sta. Mesa",
        latitude: 14.6,
        longitude: 121.01,
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z"
      },
      routeLabel: "Cubao - PUP",
      distanceKm: 5,
      durationMinutes: 30,
      corridorTags: ["cubao", "sta-mesa"],
      fare: {
        amount: 13,
        pricingType: "official",
        fareProductCode: "puj_traditional",
        ruleVersionName: "LTFRB",
        effectivityDate: "2026-01-01",
        isDiscountApplied: false,
        assumptionText: null
      }
    },
    {
      type: "walk",
      id: "walk-1",
      fromLabel: "PUP Main Gate",
      toLabel: "PUP Sta. Mesa",
      distanceMeters: 180,
      durationMinutes: 5,
      fare: {
        amount: 0,
        pricingType: "official",
        fareProductCode: null,
        ruleVersionName: null,
        effectivityDate: null,
        isDiscountApplied: false,
        assumptionText: null
      }
    }
  ],
  relevantIncidents: [],
  source: "sakai",
  navigationTarget: {
    latitude: 14.6,
    longitude: 121.01,
    label: "PUP Main Gate",
    kind: "dropoff_stop"
  }
};

describe("route summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAiClient.isAiEnabled.mockReturnValue(true);
    mockedAiClient.getLightModel.mockReturnValue("gemini-2.5-flash-lite");
  });

  it("builds a deterministic template summary", () => {
    expect(buildTemplateRouteSummary(routeOption)).toContain("Ride Cubao - PUP");
    expect(buildTemplateRouteSummary(routeOption)).toContain("Walk 5 minutes");
  });

  it("returns the AI summary when generation succeeds", async () => {
    mockedAiClient.generateJson.mockResolvedValue({
      summary: "Ride the Cubao jeep to PUP, then walk a few minutes to the campus."
    });

    const summary = await generateRouteSummary({
      option: routeOption,
      normalizedQuery: {
        origin: {
          placeId: "place-1",
          label: "Cubao",
          matchedBy: "alias",
          latitude: 14.62,
          longitude: 121.05
        },
        destination: {
          placeId: "place-2",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName",
          latitude: 14.6,
          longitude: 121.01
        },
        preference: "balanced",
        passengerType: "regular",
        preferenceSource: "default",
        passengerTypeSource: "default",
        modifiers: [],
        modifierSource: "default"
      }
    });

    expect(summary).toBe(
      "Ride the Cubao jeep to PUP, then walk a few minutes to the campus."
    );
  });

  it("falls back to the template summary when AI is disabled", async () => {
    mockedAiClient.isAiEnabled.mockReturnValue(false);

    const summary = await generateRouteSummary({
      option: routeOption,
      normalizedQuery: {
        origin: {
          placeId: "place-1",
          label: "Cubao",
          matchedBy: "alias",
          latitude: 14.62,
          longitude: 121.05
        },
        destination: {
          placeId: "place-2",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName",
          latitude: 14.6,
          longitude: 121.01
        },
        preference: "balanced",
        passengerType: "regular",
        preferenceSource: "default",
        passengerTypeSource: "default",
        modifiers: [],
        modifierSource: "default"
      }
    });

    expect(summary).toContain("Ride Cubao - PUP");
  });

  it("falls back to the template summary on recoverable AI failures", async () => {
    mockedAiClient.generateJson.mockRejectedValue(
      new aiClient.AiUnavailableError("timeout")
    );

    const summary = await generateRouteSummary({
      option: routeOption,
      normalizedQuery: {
        origin: {
          placeId: "place-1",
          label: "Cubao",
          matchedBy: "alias",
          latitude: 14.62,
          longitude: 121.05
        },
        destination: {
          placeId: "place-2",
          label: "PUP Sta. Mesa",
          matchedBy: "canonicalName",
          latitude: 14.6,
          longitude: 121.01
        },
        preference: "balanced",
        passengerType: "regular",
        preferenceSource: "default",
        passengerTypeSource: "default",
        modifiers: [],
        modifierSource: "default"
      }
    });

    expect(summary).toContain("Walk 5 minutes");
  });
});
