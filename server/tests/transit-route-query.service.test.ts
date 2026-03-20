import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    ORS_API_KEY: "ors-test-key"
  }))
}));

vi.mock("../src/models/fare.model.js", () => ({
  getActiveFareCatalog: vi.fn()
}));

vi.mock("../src/models/place.model.js", () => ({
  resolvePlaceReference: vi.fn(),
  normalizePlaceSearchText: vi.fn((value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
  )
}));

vi.mock("../src/models/transit-graph.model.js", () => ({
  listTransitStopsByClusterId: vi.fn(),
  listTransitStopsByIds: vi.fn(),
  listTransitEdgesBySourceStopIds: vi.fn(),
  findNearestTransitStops: vi.fn(),
  isTransitGraphUnavailableError: vi.fn(() => false)
}));

vi.mock("../src/ai/route-summary.js", () => ({
  generateRouteSummary: vi.fn(async () => "Transit summary")
}));

vi.mock("../src/services/route-incident.service.js", () => ({
  attachRelevantIncidentsToOptions: vi.fn(async ({ options }: { options: unknown[] }) => options)
}));

import * as fareModel from "../src/models/fare.model.js";
import * as placeModel from "../src/models/place.model.js";
import * as transitGraphModel from "../src/models/transit-graph.model.js";
import { queryTransitRoutesIfPossible } from "../src/services/transit-route-query.service.js";

const mockedFareModel = vi.mocked(fareModel);
const mockedPlaceModel = vi.mocked(placeModel);
const mockedTransitGraphModel = vi.mocked(transitGraphModel);

const fareCatalog = {
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
      id: "product-jeepney",
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
      originStopId: "cubao-lrt",
      destinationStopId: "recto-lrt",
      regularFare: 20,
      discountedFare: 16,
      createdAt: "2026-03-01T00:00:00.000Z"
    }
  ]
};

const createTransitStop = (input: {
  stopId: string;
  stopName: string;
  mode: string;
  line: string;
  latitude: number;
  longitude: number;
}) => ({
  stopId: input.stopId,
  stopName: input.stopName,
  normalizedName: input.stopName.toLowerCase().replace(/\s+/g, "-"),
  latitude: input.latitude,
  longitude: input.longitude,
  mode: input.mode,
  line: input.line,
  allModes: [input.mode],
  allLines: [input.line],
  isMultimodal: input.mode.includes("lrt"),
  lineCount: 1,
  createdAt: "2026-03-20T00:00:00.000Z"
});

describe("transit route query service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFareModel.getActiveFareCatalog.mockResolvedValue(fareCatalog);
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "cluster:cubao",
          canonicalName: "Cubao",
          city: "Quezon City",
          kind: "station",
          latitude: 14.62,
          longitude: 121.05,
          googlePlaceId: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "Cubao"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "cluster:recto",
          canonicalName: "Recto",
          city: "Manila",
          kind: "station",
          latitude: 14.603,
          longitude: 120.99,
          googlePlaceId: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "Recto"
        }
      });
  });

  it("prefers jeepney-heavy candidates when jeep_if_possible is active and attaches geometry", async () => {
    const cubaoJeep = createTransitStop({
      stopId: "cubao-jeep",
      stopName: "Cubao Jeep Terminal",
      mode: "jeep",
      line: "Cubao Jeep",
      latitude: 14.6201,
      longitude: 121.0501
    });
    const cubaoLrt = createTransitStop({
      stopId: "cubao-lrt",
      stopName: "LRT-2 Cubao",
      mode: "lrt2",
      line: "LRT-2",
      latitude: 14.6205,
      longitude: 121.0495
    });
    const gatewayJeep = createTransitStop({
      stopId: "gateway-jeep",
      stopName: "Gateway Jeep Stop",
      mode: "jeep",
      line: "Cubao Gateway Jeep",
      latitude: 14.618,
      longitude: 121.048
    });
    const rectoJeep = createTransitStop({
      stopId: "recto-jeep",
      stopName: "Recto Jeep Stop",
      mode: "jeep",
      line: "Recto Jeep",
      latitude: 14.603,
      longitude: 120.99
    });
    const rectoLrt = createTransitStop({
      stopId: "recto-lrt",
      stopName: "LRT-2 Recto",
      mode: "lrt2",
      line: "LRT-2",
      latitude: 14.6032,
      longitude: 120.9903
    });

    mockedTransitGraphModel.listTransitStopsByClusterId
      .mockResolvedValueOnce([cubaoJeep, cubaoLrt])
      .mockResolvedValueOnce([rectoJeep, rectoLrt]);
    mockedTransitGraphModel.listTransitStopsByIds.mockResolvedValue([
      cubaoJeep,
      cubaoLrt,
      gatewayJeep,
      rectoJeep,
      rectoLrt
    ]);
    mockedTransitGraphModel.listTransitEdgesBySourceStopIds.mockImplementation(
      async (sourceStopIds: string[]) => {
        const sourceStopId = sourceStopIds[0];

        if (sourceStopId === "cubao-jeep") {
          return [
            {
              sourceStopId: "cubao-jeep",
              targetStopId: "gateway-jeep",
              weight: 8,
              mode: "jeep",
              line: "Cubao Gateway Jeep",
              routeShortName: "CGJ",
              routeLongName: "Cubao Gateway Jeep",
              transfer: false,
              distanceMeters: 1600,
              estimatedTimeMinutes: 8,
              dataSource: "seed",
              createdAt: "2026-03-20T00:00:00.000Z"
            }
          ];
        }

        if (sourceStopId === "gateway-jeep") {
          return [
            {
              sourceStopId: "gateway-jeep",
              targetStopId: "recto-jeep",
              weight: 8,
              mode: "jeep",
              line: "Recto Jeep",
              routeShortName: "RJ",
              routeLongName: "Recto Jeep",
              transfer: false,
              distanceMeters: 1700,
              estimatedTimeMinutes: 8,
              dataSource: "seed",
              createdAt: "2026-03-20T00:00:00.000Z"
            }
          ];
        }

        if (sourceStopId === "cubao-lrt") {
          return [
            {
              sourceStopId: "cubao-lrt",
              targetStopId: "recto-lrt",
              weight: 9,
              mode: "lrt2",
              line: "LRT-2",
              routeShortName: "LRT2",
              routeLongName: "LRT-2",
              transfer: false,
              distanceMeters: 2200,
              estimatedTimeMinutes: 9,
              dataSource: "seed",
              createdAt: "2026-03-20T00:00:00.000Z"
            }
          ];
        }

        return [];
      }
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: {
              type: "LineString",
              coordinates: [
                [121.0501, 14.6201],
                [121.048, 14.618],
                [120.99, 14.603]
              ]
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await queryTransitRoutesIfPossible({
      origin: {
        placeId: "cluster:cubao",
        label: "Cubao"
      },
      destination: {
        placeId: "cluster:recto",
        label: "Recto"
      },
      preference: {
        value: "balanced",
        source: "request_override"
      },
      passengerType: {
        value: "regular",
        source: "request_override"
      },
      modifiers: {
        value: ["jeep_if_possible"],
        source: "request_override"
      }
    });

    expect(result).not.toBeNull();
    expect(result?.options).toHaveLength(2);
    expect(result?.options[0]?.legs.filter((leg) => leg.type === "ride").every((leg) => leg.mode === "jeepney")).toBe(true);
    expect(
      result?.options[0]?.legs.every(
        (leg) => leg.type !== "ride" || (Array.isArray(leg.pathCoordinates) && leg.pathCoordinates.length >= 2)
      )
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("adds runtime interchange edges for known rail station pairs", async () => {
    const edsaLrt = createTransitStop({
      stopId: "edsa-lrt",
      stopName: "EDSA LRT",
      mode: "lrt1",
      line: "LRT-1",
      latitude: 14.5371,
      longitude: 120.9991
    });
    const taftMrt = createTransitStop({
      stopId: "taft-mrt",
      stopName: "Taft Ave MRT",
      mode: "mrt3",
      line: "MRT-3",
      latitude: 14.5376,
      longitude: 121.0014
    });
    const boniMrt = createTransitStop({
      stopId: "boni-mrt",
      stopName: "Boni MRT",
      mode: "mrt3",
      line: "MRT-3",
      latitude: 14.5739,
      longitude: 121.0484
    });

    mockedFareModel.getActiveFareCatalog.mockResolvedValueOnce({
      ...fareCatalog,
      ruleVersions: [
        ...fareCatalog.ruleVersions,
        {
          id: "rule-mrt3",
          mode: "mrt3" as const,
          versionName: "MRT-3 2026",
          sourceName: "DOTr",
          sourceUrl: "https://example.com",
          effectivityDate: "2026-01-01",
          verifiedAt: "2026-03-01T00:00:00.000Z",
          isActive: true,
          trustLevel: "official" as const,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ],
      trainStationFares: [
        ...fareCatalog.trainStationFares,
        {
          id: "train-fare-mrt3",
          fareRuleVersionId: "rule-mrt3",
          originStopId: "taft-mrt",
          destinationStopId: "boni-mrt",
          regularFare: 16,
          discountedFare: 13,
          createdAt: "2026-03-01T00:00:00.000Z"
        }
      ]
    });
    mockedPlaceModel.resolvePlaceReference.mockReset();
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "cluster:edsa-lrt",
          canonicalName: "EDSA LRT",
          city: "Pasay",
          kind: "station",
          latitude: edsaLrt.latitude,
          longitude: edsaLrt.longitude,
          googlePlaceId: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "EDSA LRT"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "cluster:boni-mrt",
          canonicalName: "Boni MRT",
          city: "Mandaluyong",
          kind: "station",
          latitude: boniMrt.latitude,
          longitude: boniMrt.longitude,
          googlePlaceId: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "Boni MRT"
        }
      })
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "cluster:taft-mrt",
          canonicalName: "Taft Ave MRT",
          city: "Pasay",
          kind: "station",
          latitude: taftMrt.latitude,
          longitude: taftMrt.longitude,
          googlePlaceId: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "Taft Ave MRT"
        }
      });

    mockedTransitGraphModel.listTransitStopsByClusterId
      .mockResolvedValueOnce([edsaLrt])
      .mockResolvedValueOnce([boniMrt])
      .mockResolvedValueOnce([taftMrt]);
    mockedTransitGraphModel.listTransitEdgesBySourceStopIds.mockImplementation(
      async (sourceStopIds: string[]) => {
        const sourceStopId = sourceStopIds[0];

        if (sourceStopId === "edsa-lrt") {
          return [];
        }

        if (sourceStopId === "taft-mrt") {
          return [
            {
              sourceStopId: "taft-mrt",
              targetStopId: "boni-mrt",
              weight: 12,
              mode: "mrt3",
              line: "MRT-3",
              routeShortName: "MRT3",
              routeLongName: "MRT-3",
              transfer: false,
              distanceMeters: 5000,
              estimatedTimeMinutes: 12,
              dataSource: "seed",
              createdAt: "2026-03-20T00:00:00.000Z"
            }
          ];
        }

        return [];
      }
    );
    mockedTransitGraphModel.listTransitStopsByIds.mockResolvedValue([edsaLrt, taftMrt, boniMrt]);

    const result = await queryTransitRoutesIfPossible({
      origin: {
        placeId: "cluster:edsa-lrt",
        label: "EDSA LRT"
      },
      destination: {
        placeId: "cluster:boni-mrt",
        label: "Boni MRT"
      },
      preference: {
        value: "balanced",
        source: "request_override"
      },
      passengerType: {
        value: "regular",
        source: "request_override"
      },
      modifiers: {
        value: [],
        source: "request_override"
      }
    });

    expect(result).not.toBeNull();
    expect(result?.options).toHaveLength(1);
    expect(result?.options[0]?.legs.map((leg) => leg.type)).toEqual(["walk", "ride"]);
    expect(result?.options[0]?.legs[0]).toMatchObject({
      type: "walk",
      fromLabel: "EDSA LRT",
      toLabel: "Taft Ave MRT",
      durationMinutes: 1
    });
  });

  it("does not pass synthetic coordinate ids into place resolution", async () => {
    mockedPlaceModel.resolvePlaceReference.mockReset();
    mockedPlaceModel.resolvePlaceReference
      .mockResolvedValueOnce({
        status: "resolved",
        place: {
          id: "cluster:edsa-lrt",
          canonicalName: "EDSA LRT",
          city: "Pasay",
          kind: "station",
          latitude: 14.5371,
          longitude: 120.9991,
          googlePlaceId: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          matchedBy: "canonicalName",
          matchedText: "EDSA LRT"
        }
      })
      .mockResolvedValueOnce({
        status: "unresolved"
      });
    mockedTransitGraphModel.listTransitStopsByClusterId.mockResolvedValueOnce([]);
    mockedTransitGraphModel.findNearestTransitStops.mockResolvedValue([]);

    const result = await queryTransitRoutesIfPossible({
      origin: {
        placeId: "cluster:edsa-lrt",
        label: "EDSA LRT"
      },
      destination: {
        placeId: "coords:destination:14.599500:121.011400",
        label: "PUP Sta. Mesa",
        latitude: 14.5995,
        longitude: 121.0114
      },
      preference: {
        value: "balanced",
        source: "request_override"
      },
      passengerType: {
        value: "regular",
        source: "request_override"
      },
      modifiers: {
        value: [],
        source: "request_override"
      }
    });

    expect(result).toBeNull();
    expect(mockedPlaceModel.resolvePlaceReference).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        placeId: undefined,
        query: "PUP Sta. Mesa"
      })
    );
  });
});
