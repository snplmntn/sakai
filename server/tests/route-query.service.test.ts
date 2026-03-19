import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/fare.model.js", () => ({
  getActiveFareCatalog: vi.fn()
}));

vi.mock("../src/models/place.model.js", () => ({
  resolvePlaceReference: vi.fn()
}));

vi.mock("../src/models/route.model.js", () => ({
  listActiveRouteVariants: vi.fn()
}));

vi.mock("../src/models/stop.model.js", () => ({
  findNearestStops: vi.fn(),
  listStopsByPlaceId: vi.fn()
}));

vi.mock("../src/models/transfer-point.model.js", () => ({
  listTransferPointsByStopIds: vi.fn()
}));

vi.mock("../src/models/user-preference.model.js", () => ({
  getUserPreferenceByUserId: vi.fn()
}));

vi.mock("../src/ai/intent-parser.js", () => ({
  parseRouteIntent: vi.fn()
}));

vi.mock("../src/ai/route-summary.js", () => ({
  generateRouteSummary: vi.fn()
}));

import { AiUnavailableError } from "../src/ai/client.js";
import * as intentParser from "../src/ai/intent-parser.js";
import * as routeSummary from "../src/ai/route-summary.js";
import * as fareModel from "../src/models/fare.model.js";
import * as placeModel from "../src/models/place.model.js";
import * as routeModel from "../src/models/route.model.js";
import * as stopModel from "../src/models/stop.model.js";
import * as transferPointModel from "../src/models/transfer-point.model.js";
import * as userPreferenceModel from "../src/models/user-preference.model.js";
import { queryRoutes } from "../src/services/route-query.service.js";

const mockedFareModel = vi.mocked(fareModel);
const mockedIntentParser = vi.mocked(intentParser);
const mockedPlaceModel = vi.mocked(placeModel);
const mockedRouteModel = vi.mocked(routeModel);
const mockedRouteSummary = vi.mocked(routeSummary);
const mockedStopModel = vi.mocked(stopModel);
const mockedTransferPointModel = vi.mocked(transferPointModel);
const mockedUserPreferenceModel = vi.mocked(userPreferenceModel);

const createStop = (id: string, stopName: string, mode: "jeepney" | "lrt2", placeId: string | null = null) => ({
  id,
  placeId,
  stopName,
  mode,
  area: "Metro Manila",
  latitude: 14.6,
  longitude: 121.0,
  isActive: true,
  createdAt: "2026-03-19T00:00:00.000Z"
});

const jeepneyFareCatalog = {
  ruleVersions: [
    {
      id: "rule-jeepney",
      mode: "jeepney" as const,
      versionName: "LTFRB 2026",
      sourceName: "LTFRB",
      sourceUrl: "https://ltfrb.gov.ph",
      effectivityDate: "2026-01-01",
      verifiedAt: "2026-03-01T00:00:00.000Z",
      isActive: true,
      trustLevel: "official" as const,
      createdAt: "2026-03-01T00:00:00.000Z"
    },
    {
      id: "rule-lrt2",
      mode: "lrt2" as const,
      versionName: "LRT-2 2026",
      sourceName: "LRTA",
      sourceUrl: "https://example.com",
      effectivityDate: "2026-01-01",
      verifiedAt: "2026-03-01T00:00:00.000Z",
      isActive: true,
      trustLevel: "official" as const,
      createdAt: "2026-03-01T00:00:00.000Z"
    }
  ],
  fareProducts: [
    {
      id: "product-1",
      fareRuleVersionId: "rule-jeepney",
      productCode: "puj_traditional",
      mode: "jeepney" as const,
      pricingStrategy: "minimum_plus_succeeding" as const,
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
  ],
  trainStationFares: [
    {
      id: "train-fare-1",
      fareRuleVersionId: "rule-lrt2",
      originStopId: "station-a",
      destinationStopId: "station-b",
      regularFare: 20,
      discountedFare: 16,
      createdAt: "2026-03-01T00:00:00.000Z"
    }
  ]
};

describe("route query service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIntentParser.parseRouteIntent.mockResolvedValue({
      originText: "Cubao",
      destinationText: "PUP Sta. Mesa",
      preference: null,
      passengerType: null,
      requiresClarification: false,
      clarificationField: null,
      confidence: "high"
    });
    mockedRouteSummary.generateRouteSummary.mockImplementation(async () => "Route summary");
    mockedStopModel.findNearestStops.mockResolvedValue([]);
    mockedTransferPointModel.listTransferPointsByStopIds.mockResolvedValue([]);
    mockedFareModel.getActiveFareCatalog.mockResolvedValue(jeepneyFareCatalog);
  });

  it("uses saved preferences when request overrides are absent and returns a direct route", async () => {
    const originStop = createStop("stop-origin", "Cubao Terminal", "jeepney", "place-origin");
    const transferStop = createStop("stop-transfer", "V. Mapa", "jeepney");
    const destinationStop = createStop("stop-destination", "PUP Main Gate", "jeepney", "place-destination");

    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue({
      userId: "user-1",
      defaultPreference: "cheapest",
      passengerType: "student",
      createdAt: "2026-03-19T00:00:00.000Z",
      updatedAt: "2026-03-19T00:00:00.000Z"
    });
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-origin",
          canonicalName: "Cubao",
          city: "Quezon City",
          kind: "area",
          latitude: 14.62,
          longitude: 121.05,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "alias",
          matchedText: "Cubao"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-destination",
          canonicalName: "PUP Sta. Mesa",
          city: "Manila",
          kind: "campus",
          latitude: 14.6,
          longitude: 121.01,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "PUP Sta. Mesa"
        }
      });
    mockedStopModel.listStopsByPlaceId
      .mockResolvedValueOnce([originStop])
      .mockResolvedValueOnce([destinationStop]);
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([
      {
        id: "variant-1",
        routeId: "route-1",
        displayName: "Cubao to PUP",
        directionLabel: "Eastbound",
        originPlaceId: "place-origin",
        destinationPlaceId: "place-destination",
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-1",
          code: "JEEP-CUBAO-PUP",
          displayName: "Cubao - PUP",
          primaryMode: "jeepney",
          operatorName: null,
          sourceName: "seed",
          sourceUrl: null,
          trustLevel: "trusted_seed",
          isActive: true,
          createdAt: "2026-03-19T00:00:00.000Z"
        },
        legs: [
          {
            id: "leg-1",
            routeVariantId: "variant-1",
            sequence: 1,
            mode: "jeepney",
            fromStop: originStop,
            toStop: transferStop,
            routeLabel: "Cubao - V. Mapa",
            distanceKm: 4,
            durationMinutes: 15,
            fareProductCode: "puj_traditional",
            corridorTag: "cubao",
            createdAt: "2026-03-19T00:00:00.000Z"
          },
          {
            id: "leg-2",
            routeVariantId: "variant-1",
            sequence: 2,
            mode: "jeepney",
            fromStop: transferStop,
            toStop: destinationStop,
            routeLabel: "V. Mapa - PUP",
            distanceKm: 2,
            durationMinutes: 12,
            fareProductCode: "puj_traditional",
            corridorTag: "sta-mesa",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      }
    ]);

    const result = await queryRoutes({
      request: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "PUP Sta. Mesa"
        }
      },
      userId: "user-1"
    });

    expect(result.normalizedQuery.preference).toBe("cheapest");
    expect(result.normalizedQuery.preferenceSource).toBe("saved_preference");
    expect(result.normalizedQuery.passengerType).toBe("student");
    expect(result.options).toHaveLength(1);
    expect(result.options[0]?.totalFare).toBe(13.28);
    expect(result.options[0]?.transferCount).toBe(0);
    expect(result.options[0]?.recommendationLabel).toBe("Cheapest option");
  });

  it("uses AI-parsed query text when explicit points are absent", async () => {
    const originStop = createStop("stop-origin", "Cubao Terminal", "jeepney", "place-origin");
    const destinationStop = createStop(
      "stop-destination",
      "PUP Main Gate",
      "jeepney",
      "place-destination"
    );

    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedIntentParser.parseRouteIntent.mockResolvedValue({
      originText: "Cubao",
      destinationText: "PUP Sta. Mesa",
      preference: "cheapest",
      passengerType: "student",
      requiresClarification: false,
      clarificationField: null,
      confidence: "high"
    });
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-origin",
          canonicalName: "Cubao",
          city: "Quezon City",
          kind: "area",
          latitude: 14.62,
          longitude: 121.05,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "alias",
          matchedText: "Cubao"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-destination",
          canonicalName: "PUP Sta. Mesa",
          city: "Manila",
          kind: "campus",
          latitude: 14.6,
          longitude: 121.01,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "PUP Sta. Mesa"
        }
      });
    mockedStopModel.listStopsByPlaceId
      .mockResolvedValueOnce([originStop])
      .mockResolvedValueOnce([destinationStop]);
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([
      {
        id: "variant-1",
        routeId: "route-1",
        displayName: "Cubao to PUP",
        directionLabel: "Eastbound",
        originPlaceId: "place-origin",
        destinationPlaceId: "place-destination",
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-1",
          code: "JEEP-CUBAO-PUP",
          displayName: "Cubao - PUP",
          primaryMode: "jeepney",
          operatorName: null,
          sourceName: "seed",
          sourceUrl: null,
          trustLevel: "trusted_seed",
          isActive: true,
          createdAt: "2026-03-19T00:00:00.000Z"
        },
        legs: [
          {
            id: "leg-1",
            routeVariantId: "variant-1",
            sequence: 1,
            mode: "jeepney",
            fromStop: originStop,
            toStop: destinationStop,
            routeLabel: "Cubao - PUP",
            distanceKm: 5,
            durationMinutes: 25,
            fareProductCode: "puj_traditional",
            corridorTag: "cubao",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      }
    ]);

    const result = await queryRoutes({
      request: {
        queryText: "cheapest way to PUP Sta. Mesa from Cubao as a student"
      }
    });

    expect(mockedIntentParser.parseRouteIntent).toHaveBeenCalled();
    expect(result.normalizedQuery.preference).toBe("cheapest");
    expect(result.normalizedQuery.preferenceSource).toBe("ai_parsed");
    expect(result.normalizedQuery.passengerType).toBe("student");
    expect(result.normalizedQuery.passengerTypeSource).toBe("ai_parsed");
  });

  it("keeps explicit overrides ahead of AI-parsed hints", async () => {
    const originStop = createStop("stop-origin", "Cubao Terminal", "jeepney", "place-origin");
    const destinationStop = createStop(
      "stop-destination",
      "PUP Main Gate",
      "jeepney",
      "place-destination"
    );

    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedIntentParser.parseRouteIntent.mockResolvedValue({
      originText: "Gateway",
      destinationText: "Somewhere Else",
      preference: "fastest",
      passengerType: "student",
      requiresClarification: false,
      clarificationField: null,
      confidence: "high"
    });
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-origin",
          canonicalName: "Cubao",
          city: "Quezon City",
          kind: "area",
          latitude: 14.62,
          longitude: 121.05,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "alias",
          matchedText: "Cubao"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-destination",
          canonicalName: "PUP Sta. Mesa",
          city: "Manila",
          kind: "campus",
          latitude: 14.6,
          longitude: 121.01,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "PUP Sta. Mesa"
        }
      });
    mockedStopModel.listStopsByPlaceId
      .mockResolvedValueOnce([originStop])
      .mockResolvedValueOnce([destinationStop]);
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([
      {
        id: "variant-1",
        routeId: "route-1",
        displayName: "Cubao to PUP",
        directionLabel: "Eastbound",
        originPlaceId: "place-origin",
        destinationPlaceId: "place-destination",
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-1",
          code: "JEEP-CUBAO-PUP",
          displayName: "Cubao - PUP",
          primaryMode: "jeepney",
          operatorName: null,
          sourceName: "seed",
          sourceUrl: null,
          trustLevel: "trusted_seed",
          isActive: true,
          createdAt: "2026-03-19T00:00:00.000Z"
        },
        legs: [
          {
            id: "leg-1",
            routeVariantId: "variant-1",
            sequence: 1,
            mode: "jeepney",
            fromStop: originStop,
            toStop: destinationStop,
            routeLabel: "Cubao - PUP",
            distanceKm: 5,
            durationMinutes: 25,
            fareProductCode: "puj_traditional",
            corridorTag: "cubao",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      }
    ]);

    const result = await queryRoutes({
      request: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "PUP Sta. Mesa"
        },
        queryText: "fastest route from Gateway to Somewhere Else for students",
        preference: "balanced",
        passengerType: "regular"
      }
    });

    expect(result.normalizedQuery.preference).toBe("balanced");
    expect(result.normalizedQuery.preferenceSource).toBe("request_override");
    expect(result.normalizedQuery.passengerType).toBe("regular");
    expect(result.normalizedQuery.passengerTypeSource).toBe("request_override");
  });

  it("builds a one-transfer route with an explicit walk leg", async () => {
    const originStop = createStop("stop-origin", "Cubao Terminal", "jeepney", "place-origin");
    const stationA = createStop("station-a", "LRT-2 Cubao", "lrt2");
    const destinationStop = createStop("station-b", "LRT-2 Recto", "lrt2", "place-destination");

    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-origin",
          canonicalName: "Cubao",
          city: "Quezon City",
          kind: "area",
          latitude: 14.62,
          longitude: 121.05,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "alias",
          matchedText: "Cubao"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-destination",
          canonicalName: "PUP Sta. Mesa",
          city: "Manila",
          kind: "campus",
          latitude: 14.6,
          longitude: 121.01,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "PUP Sta. Mesa"
        }
      });
    mockedStopModel.listStopsByPlaceId
      .mockResolvedValueOnce([originStop])
      .mockResolvedValueOnce([destinationStop]);
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([
      {
        id: "variant-jeep",
        routeId: "route-jeep",
        displayName: "Cubao to LRT-2 Cubao",
        directionLabel: "Southbound",
        originPlaceId: "place-origin",
        destinationPlaceId: null,
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-jeep",
          code: "JEEP-CUBAO-LRT",
          displayName: "Cubao - LRT",
          primaryMode: "jeepney",
          operatorName: null,
          sourceName: "seed",
          sourceUrl: null,
          trustLevel: "trusted_seed",
          isActive: true,
          createdAt: "2026-03-19T00:00:00.000Z"
        },
        legs: [
          {
            id: "leg-jeep",
            routeVariantId: "variant-jeep",
            sequence: 1,
            mode: "jeepney",
            fromStop: originStop,
            toStop: stationA,
            routeLabel: "Cubao - LRT",
            distanceKm: 3,
            durationMinutes: 10,
            fareProductCode: "puj_traditional",
            corridorTag: "cubao",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      },
      {
        id: "variant-lrt",
        routeId: "route-lrt",
        displayName: "LRT-2 Cubao to Recto",
        directionLabel: "Westbound",
        originPlaceId: null,
        destinationPlaceId: "place-destination",
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-lrt",
          code: "LRT2-CUBAO-RECTO",
          displayName: "LRT-2",
          primaryMode: "lrt2",
          operatorName: null,
          sourceName: "seed",
          sourceUrl: null,
          trustLevel: "trusted_seed",
          isActive: true,
          createdAt: "2026-03-19T00:00:00.000Z"
        },
        legs: [
          {
            id: "leg-lrt",
            routeVariantId: "variant-lrt",
            sequence: 1,
            mode: "lrt2",
            fromStop: stationA,
            toStop: destinationStop,
            routeLabel: "LRT-2",
            distanceKm: 0,
            durationMinutes: 14,
            fareProductCode: null,
            corridorTag: "lrt2",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      }
    ]);
    mockedTransferPointModel.listTransferPointsByStopIds.mockResolvedValue([
      {
        id: "transfer-1",
        fromStopId: stationA.id,
        toStopId: stationA.id,
        walkingDistanceM: 120,
        walkingDurationMinutes: 2,
        isAccessible: true,
        createdAt: "2026-03-19T00:00:00.000Z"
      }
    ]);

    const result = await queryRoutes({
      request: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "PUP Sta. Mesa"
        },
        preference: "fastest",
        passengerType: "regular"
      }
    });

    expect(result.options).toHaveLength(1);
    expect(result.options[0]?.transferCount).toBe(1);
    expect(result.options[0]?.legs.map((leg) => leg.type)).toEqual(["ride", "walk", "ride"]);
    expect(result.options[0]?.recommendationLabel).toBe("Fastest option");
  });

  it("returns clarification when AI parsing requires it", async () => {
    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedIntentParser.parseRouteIntent.mockResolvedValue({
      originText: null,
      destinationText: "PUP Sta. Mesa",
      preference: null,
      passengerType: null,
      requiresClarification: true,
      clarificationField: "origin",
      confidence: "low"
    });

    await expect(
      queryRoutes({
        request: {
          queryText: "How do I get to PUP Sta. Mesa?"
        }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: {
        reasonCode: "clarification_required",
        field: "origin"
      }
    });
  });

  it("returns 503 when query text depends on AI and parsing is unavailable", async () => {
    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedIntentParser.parseRouteIntent.mockRejectedValue(
      new AiUnavailableError("Gemini is unavailable")
    );

    await expect(
      queryRoutes({
        request: {
          queryText: "cheapest way to PUP Sta. Mesa from Cubao"
        }
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      details: {
        reasonCode: "ai_temporarily_unavailable"
      }
    });
  });

  it("returns a 422-style error when a point is ambiguous", async () => {
    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedPlaceModel.resolvePlaceReference.mockResolvedValueOnce({
      status: "ambiguous",
      matches: [
        {
          id: "place-1",
          canonicalName: "SM North EDSA",
          city: "Quezon City",
          kind: "mall",
          latitude: 14.6,
          longitude: 121.0,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "alias",
          matchedText: "SM"
        }
      ]
    });
    mockedPlaceModel.resolvePlaceReference.mockResolvedValueOnce({
      status: "resolved",
      place: {
        id: "place-2",
        canonicalName: "PUP Sta. Mesa",
        city: "Manila",
        kind: "campus",
        latitude: 14.6,
        longitude: 121.01,
        googlePlaceId: null,
        createdAt: "2026-03-19T00:00:00.000Z",
        matchedBy: "canonicalName",
        matchedText: "PUP Sta. Mesa"
      }
    });

    await expect(
      queryRoutes({
        request: {
          origin: {
            label: "SM"
          },
          destination: {
            label: "PUP Sta. Mesa"
          }
        }
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      message: "origin matches multiple supported places"
    });
  });

  it("returns an empty result when coverage does not connect the resolved points", async () => {
    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-origin",
          canonicalName: "Cubao",
          city: "Quezon City",
          kind: "area",
          latitude: 14.62,
          longitude: 121.05,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "alias",
          matchedText: "Cubao"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-destination",
          canonicalName: "PUP Sta. Mesa",
          city: "Manila",
          kind: "campus",
          latitude: 14.6,
          longitude: 121.01,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "PUP Sta. Mesa"
        }
      });
    mockedStopModel.listStopsByPlaceId
      .mockResolvedValueOnce([createStop("stop-origin", "Cubao Terminal", "jeepney", "place-origin")])
      .mockResolvedValueOnce([createStop("stop-destination", "PUP Main Gate", "jeepney", "place-destination")]);
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([]);

    const result = await queryRoutes({
      request: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "PUP Sta. Mesa"
        }
      }
    });

    expect(result.options).toEqual([]);
    expect(result.message).toBe(
      "No supported route found for Cubao to PUP Sta. Mesa in the current coverage"
    );
  });
});
