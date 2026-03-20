import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/fare.model.js", () => ({
  getActiveFareCatalog: vi.fn()
}));

vi.mock("../src/models/area-update.model.js", () => ({
  listActiveAreaUpdates: vi.fn()
}));

vi.mock("../src/models/place.model.js", () => ({
  resolvePlaceReference: vi.fn(),
  getPlaceById: vi.fn(),
  normalizePlaceSearchText: vi.fn((value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
  )
}));

vi.mock("../src/models/route.model.js", () => ({
  listActiveRouteVariants: vi.fn()
}));

vi.mock("../src/models/stop.model.js", () => ({
  findNearestStops: vi.fn(),
  listStopsByPlaceId: vi.fn(),
  isStopsAccessUnavailableError: vi.fn((error: unknown) => {
    return (
      error instanceof Error &&
      error.message.toLowerCase().includes("permission denied") &&
      error.message.toLowerCase().includes("table stops")
    );
  })
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
import * as areaUpdateModel from "../src/models/area-update.model.js";
import * as routeSummary from "../src/ai/route-summary.js";
import * as fareModel from "../src/models/fare.model.js";
import * as placeModel from "../src/models/place.model.js";
import * as routeModel from "../src/models/route.model.js";
import * as stopModel from "../src/models/stop.model.js";
import * as transferPointModel from "../src/models/transfer-point.model.js";
import * as userPreferenceModel from "../src/models/user-preference.model.js";
import { queryRoutes } from "../src/services/route-query.service.js";
import { HttpError } from "../src/types/http-error.js";

const mockedFareModel = vi.mocked(fareModel);
const mockedIntentParser = vi.mocked(intentParser);
const mockedAreaUpdateModel = vi.mocked(areaUpdateModel);
const mockedPlaceModel = vi.mocked(placeModel);
const mockedRouteModel = vi.mocked(routeModel);
const mockedRouteSummary = vi.mocked(routeSummary);
const mockedStopModel = vi.mocked(stopModel);
const mockedTransferPointModel = vi.mocked(transferPointModel);
const mockedUserPreferenceModel = vi.mocked(userPreferenceModel);

const createStop = (id: string, stopName: string, mode: "jeepney" | "lrt2", placeId: string | null = null) => ({
  id,
  placeId,
  externalStopCode: null,
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
      minimumFareDiscounted: 13,
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
    },
    {
      id: "train-fare-2",
      fareRuleVersionId: "rule-lrt2",
      originStopId: "stop-lrt-board",
      destinationStopId: "stop-lrt-alight",
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
      modifiers: [],
      requiresClarification: false,
      clarificationField: null,
      confidence: "high"
    });
    mockedRouteSummary.generateRouteSummary.mockImplementation(async () => "Route summary");
    mockedAreaUpdateModel.listActiveAreaUpdates.mockResolvedValue([]);
    mockedPlaceModel.getPlaceById.mockResolvedValue(null);
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
        code: "JEEP-CUBAO-PUP:EASTBOUND",
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
    expect(result.options[0]?.totalFare).toBe(15.88);
    expect(result.options[0]?.transferCount).toBe(0);
    expect(result.options[0]?.recommendationLabel).toBe("Best for your preference");
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
      modifiers: ["less_walking"],
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
        code: "JEEP-CUBAO-PUP:EASTBOUND",
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
    expect(result.normalizedQuery.modifiers).toEqual(["less_walking"]);
    expect(result.normalizedQuery.modifierSource).toBe("ai_parsed");
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
      modifiers: ["jeep_if_possible"],
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
        code: "JEEP-CUBAO-PUP:EASTBOUND",
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
        passengerType: "regular",
        modifiers: ["less_walking"]
      }
    });

    expect(result.normalizedQuery.preference).toBe("balanced");
    expect(result.normalizedQuery.preferenceSource).toBe("request_override");
    expect(result.normalizedQuery.passengerType).toBe("regular");
    expect(result.normalizedQuery.passengerTypeSource).toBe("request_override");
    expect(result.normalizedQuery.modifiers).toEqual(["less_walking"]);
    expect(result.normalizedQuery.modifierSource).toBe("request_override");
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
        code: "JEEP-CUBAO-LRT:SOUTHBOUND",
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
        code: "LRT2-CUBAO-RECTO:WESTBOUND",
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
    expect(result.options[0]?.recommendationLabel).toBe("Best for your preference");
  });

  it("builds a multi-transfer route when two transfers are needed", async () => {
    const originStop = createStop("stop-origin", "Cubao Terminal", "jeepney", "place-origin");
    const transferToTrainStart = createStop("stop-transfer-jeep-lrt", "EDSA Terminal", "jeepney");
    const trainBoarding = createStop("stop-lrt-board", "LRT-1 Baclaran", "lrt2");
    const trainAlight = createStop("stop-lrt-alight", "LRT-1 Guadalupe", "lrt2");
    const transferToJeep = createStop("stop-transfer-lrt-jeep", "SM North", "jeepney");
    const destinationStop = createStop("stop-destination", "PUP Main Gate", "jeepney", "place-destination");

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
        id: "variant-jeep-1",
        routeId: "route-jeep-1",
        code: "JEEP-CUBAO-EDSA:OUTBOUND",
        displayName: "Cubao to EDSA",
        directionLabel: "Outbound",
        originPlaceId: "place-origin",
        destinationPlaceId: null,
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-jeep-1",
          code: "JEEP-CUBAO-EDSA",
          displayName: "Cubao - EDSA Jeep",
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
            id: "leg-jeep-1",
            routeVariantId: "variant-jeep-1",
            sequence: 1,
            mode: "jeepney",
            fromStop: originStop,
            toStop: transferToTrainStart,
            routeLabel: "Cubao - EDSA",
            distanceKm: 3,
            durationMinutes: 12,
            fareProductCode: "puj_traditional",
            corridorTag: "cubao",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      },
      {
        id: "variant-lrt",
        routeId: "route-lrt",
        code: "LRT2-TRANSFER:OUTBOUND",
        displayName: "LRT-2 board to alight",
        directionLabel: "Outbound",
        originPlaceId: null,
        destinationPlaceId: null,
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-lrt",
          code: "LRT2-TRANSFER",
          displayName: "LRT-2 Transfer Leg",
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
            fromStop: trainBoarding,
            toStop: trainAlight,
            routeLabel: "LRT-2",
            distanceKm: 0,
            durationMinutes: 11,
            fareProductCode: null,
            corridorTag: "lrt2",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      },
      {
        id: "variant-jeep-2",
        routeId: "route-jeep-2",
        code: "JEEP-SM-DEST:OUTBOUND",
        displayName: "SM to PUP",
        directionLabel: "Outbound",
        originPlaceId: null,
        destinationPlaceId: "place-destination",
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-jeep-2",
          code: "JEEP-SM-DEST",
          displayName: "SM - PUP Jeep",
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
            id: "leg-jeep-2",
            routeVariantId: "variant-jeep-2",
            sequence: 1,
            mode: "jeepney",
            fromStop: transferToJeep,
            toStop: destinationStop,
            routeLabel: "SM - PUP",
            distanceKm: 4,
            durationMinutes: 18,
            fareProductCode: "puj_traditional",
            corridorTag: "sm",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      }
    ]);
    mockedTransferPointModel.listTransferPointsByStopIds.mockResolvedValue([
      {
        id: "transfer-jeep-lrt",
        fromStopId: transferToTrainStart.id,
        toStopId: trainBoarding.id,
        walkingDistanceM: 80,
        walkingDurationMinutes: 2,
        isAccessible: true,
        createdAt: "2026-03-19T00:00:00.000Z"
      },
      {
        id: "transfer-lrt-jeep",
        fromStopId: trainAlight.id,
        toStopId: transferToJeep.id,
        walkingDistanceM: 180,
        walkingDurationMinutes: 4,
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
    expect(result.options[0]?.transferCount).toBe(2);
    expect(result.options[0]?.legs.map((leg) => leg.type)).toEqual([
      "ride",
      "walk",
      "ride",
      "walk",
      "ride"
    ]);
  });

  it("returns clarification when AI parsing requires it", async () => {
    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedIntentParser.parseRouteIntent.mockResolvedValue({
      originText: null,
      destinationText: "PUP Sta. Mesa",
      preference: null,
      passengerType: null,
      modifiers: [],
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

  it("treats a coordinate-backed origin as resolved when place lookup fails", async () => {
    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "unresolved"
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
    mockedStopModel.findNearestStops.mockRejectedValue(
      new HttpError(500, "Failed to search stops: permission denied for table stops")
    );
    mockedStopModel.listStopsByPlaceId.mockRejectedValue(
      new HttpError(500, "Failed to fetch stops: permission denied for table stops")
    );
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([]);

    const result = await queryRoutes({
      request: {
        origin: {
          label: "My location",
          latitude: 14.5981,
          longitude: 121.0356
        },
        destination: {
          label: "PUP Sta. Mesa"
        }
      }
    });

    expect(result.normalizedQuery.origin.matchedBy).toBe("coordinates");
    expect(result.normalizedQuery.origin.placeId).toBe("coords:origin:14.598100:121.035600");
    expect(result.options).toEqual([]);
    expect(result.message).toBe(
      "No supported route found for My location to PUP Sta. Mesa in the current coverage"
    );
  });

  it("treats a coordinate-backed destination as resolved when place lookup fails", async () => {
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
        status: "unresolved"
      });
    mockedStopModel.findNearestStops.mockRejectedValue(
      new HttpError(500, "Failed to search stops: permission denied for table stops")
    );
    mockedStopModel.listStopsByPlaceId.mockRejectedValue(
      new HttpError(500, "Failed to fetch stops: permission denied for table stops")
    );
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([]);

    const result = await queryRoutes({
      request: {
        origin: {
          label: "Cubao"
        },
        destination: {
          label: "DLSU",
          latitude: 14.5649,
          longitude: 120.9943
        }
      }
    });

    expect(result.normalizedQuery.destination.matchedBy).toBe("coordinates");
    expect(result.normalizedQuery.destination.placeId).toBe("coords:destination:14.564900:120.994300");
    expect(result.options).toEqual([]);
    expect(result.message).toBe(
      "No supported route found for Cubao to DLSU in the current coverage"
    );
  });

  it("resolves a stored google place id before falling back to coordinates", async () => {
    const originStop = createStop("stop-origin", "Alabang", "jeepney", "place-origin");
    const destinationStop = createStop("stop-destination", "Pasay", "jeepney", "place-destination");

    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-origin",
          canonicalName: "Alabang",
          city: "Muntinlupa",
          kind: "terminal",
          latitude: 14.423127,
          longitude: 121.045653,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "Alabang"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-destination",
          canonicalName: "Pasay",
          city: "Pasay",
          kind: "terminal",
          latitude: 14.537745,
          longitude: 121.001557,
          googlePlaceId: "google-place-pasay",
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "googlePlaceId",
          matchedText: "google-place-pasay"
        }
      });
    mockedStopModel.listStopsByPlaceId
      .mockResolvedValueOnce([originStop])
      .mockResolvedValueOnce([destinationStop]);
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([
      {
        id: "variant-1",
        routeId: "route-1",
        code: "JEEP-ALABANG-PASAY:OUTBOUND",
        displayName: "Alabang to Pasay",
        directionLabel: "Outbound",
        originPlaceId: "place-origin",
        destinationPlaceId: "place-destination",
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-1",
          code: "JEEP-ALABANG-PASAY",
          displayName: "Alabang - Pasay",
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
            routeLabel: "Alabang - Pasay",
            distanceKm: 18,
            durationMinutes: 48,
            fareProductCode: "puj_traditional",
            corridorTag: "alabang-pasay",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      }
    ]);
    mockedAreaUpdateModel.listActiveAreaUpdates.mockResolvedValue([
      {
        id: "incident-1",
        externalId: "mmda-1",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Road crash incident",
        location: "Cubao corridor",
        direction: "EB",
        involved: "2 vehicles",
        reportedTimeText: "5:29 PM",
        laneStatus: "One lane occupied",
        trafficStatus: "MMDA enforcers are on site managing traffic",
        severity: "medium",
        summary: "Crash along the Cubao corridor may slow this route.",
        corridorTags: ["cubao"],
        normalizedLocation: "cubao corridor",
        displayUntil: "2026-03-19T13:05:00.000Z",
        rawText: "MMDA ALERT...",
        scrapedAt: "2026-03-19T10:05:00.000Z",
        createdAt: "2026-03-19T10:05:00.000Z"
      }
    ]);
    const result = await queryRoutes({
      request: {
        origin: {
          label: "Alabang"
        },
        destination: {
          googlePlaceId: "google-place-pasay",
          label: "Pasay Rotonda"
        },
        preference: "balanced",
        passengerType: "regular"
      }
    });

    expect(mockedPlaceModel.resolvePlaceReference).toHaveBeenNthCalledWith(2, {
      placeId: undefined,
      googlePlaceId: "google-place-pasay",
      query: "Pasay Rotonda"
    });
    expect(result.normalizedQuery.destination.placeId).toBe("place-destination");
    expect(result.normalizedQuery.destination.matchedBy).toBe("googlePlaceId");
    expect(result.options).toHaveLength(1);
  });

  it("falls back to nearby coordinates when a google-selected label is not stored internally", async () => {
    const originStop = createStop("stop-origin", "Alabang", "jeepney", "place-origin");
    const destinationStop = createStop("stop-destination", "Pasay", "jeepney", "place-destination");

    mockedUserPreferenceModel.getUserPreferenceByUserId.mockResolvedValue(null);
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "place-origin",
          canonicalName: "Alabang",
          city: "Muntinlupa",
          kind: "terminal",
          latitude: 14.423127,
          longitude: 121.045653,
          googlePlaceId: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "Alabang"
        }
      })
      .mockResolvedValueOnce({
        status: "unresolved"
      });
    mockedPlaceModel.getPlaceById.mockResolvedValue({
      id: "place-destination",
      canonicalName: "Pasay",
      city: "Pasay",
      kind: "terminal",
      latitude: 14.537745,
      longitude: 121.001557,
      googlePlaceId: null,
      createdAt: "2026-03-19T00:00:00.000Z"
    });
    mockedStopModel.listStopsByPlaceId
      .mockResolvedValueOnce([originStop])
      .mockResolvedValueOnce([destinationStop]);
    mockedStopModel.findNearestStops.mockResolvedValueOnce([
      {
        ...destinationStop,
        distanceMeters: 35
      }
    ]);
    mockedRouteModel.listActiveRouteVariants.mockResolvedValue([
      {
        id: "variant-1",
        routeId: "route-1",
        code: "JEEP-ALABANG-PASAY:OUTBOUND",
        displayName: "Alabang to Pasay",
        directionLabel: "Outbound",
        originPlaceId: "place-origin",
        destinationPlaceId: "place-destination",
        isActive: true,
        createdAt: "2026-03-19T00:00:00.000Z",
        route: {
          id: "route-1",
          code: "JEEP-ALABANG-PASAY",
          displayName: "Alabang - Pasay",
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
            routeLabel: "Alabang - Pasay",
            distanceKm: 18,
            durationMinutes: 48,
            fareProductCode: "puj_traditional",
            corridorTag: "alabang-pasay",
            createdAt: "2026-03-19T00:00:00.000Z"
          }
        ]
      }
    ]);

    const result = await queryRoutes({
      request: {
        origin: {
          label: "Alabang"
        },
        destination: {
          googlePlaceId: "google-place-pasay",
          label: "Pasay Rotonda",
          latitude: 14.53775,
          longitude: 121.00156
        },
        preference: "balanced",
        passengerType: "regular"
      }
    });

    expect(result.normalizedQuery.destination.placeId).toBe("place-destination");
    expect(result.normalizedQuery.destination.matchedBy).toBe("coordinates");
    expect(result.options).toHaveLength(1);
  });
});
