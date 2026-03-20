import { describe, it, expect } from "vitest";
import {
  getTransitEdgeTraversalWeight,
  getTransferMultiplier,
  getJeepneyPriorityAdjustment,
  getStopFamily
} from "../src/services/route-planner-rules.js";
import { mapTransitModeToRideMode } from "../src/services/transit-route-query.service.js";
import type { TransitStopEdge } from "../src/models/transit-graph.model.js";

const buildEdge = (overrides: Partial<TransitStopEdge> = {}): TransitStopEdge => ({
  sourceStopId: "stop_a",
  targetStopId: "stop_b",
  weight: 5,
  mode: "jeep",
  line: "",
  routeShortName: null,
  routeLongName: null,
  transfer: false,
  distanceMeters: 1000,
  estimatedTimeMinutes: 5,
  dataSource: "test",
  createdAt: "2025-01-01T00:00:00.000Z",
  ...overrides
});

const buildStop = (overrides: Partial<import("../src/models/transit-graph.model.js").TransitStop> = {}) => ({
  stopId: "stop_id",
  stopName: "Stop Name",
  normalizedName: "stop name",
  latitude: 14.5,
  longitude: 121.0,
  mode: "jeep",
  line: "",
  allModes: ["jeep"],
  allLines: [],
  isMultimodal: false,
  lineCount: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  ...overrides
});

describe("getTransitEdgeTraversalWeight", () => {
  it("applies jeep multiplier (0.72) for balanced preference", () => {
    const weight = getTransitEdgeTraversalWeight({
      edge: buildEdge({ mode: "jeep", estimatedTimeMinutes: 10 }),
      preference: "balanced",
      modifiers: [],
      originFamily: "jeep",
      destinationFamily: "jeep"
    });

    // baseCost=10, transferPenalty=0, hopPenalty=0.35
    // mix multiplier: jeep = 0.72
    // balanced multiplier (jeep generic): 0.9
    // (10 + 0 + 0.35) * 0.72 * 0.9 = 6.7068
    expect(weight).toBeCloseTo((10 + 0.35) * 0.72 * 0.9, 2);
  });

  it("applies rail multiplier (1.22) for balanced preference", () => {
    const weight = getTransitEdgeTraversalWeight({
      edge: buildEdge({ mode: "lrt", estimatedTimeMinutes: 10, line: "lrt1" }),
      preference: "balanced",
      modifiers: [],
      originFamily: "jeep",
      destinationFamily: "jeep"
    });

    // mix multiplier: rail = 1.22
    // balanced multiplier (rail generic): 1.04
    expect(weight).toBeCloseTo((10 + 0.35) * 1.22 * 1.04, 2);
  });

  it("applies transfer penalty of 6", () => {
    const weight = getTransitEdgeTraversalWeight({
      edge: buildEdge({
        mode: "transfer",
        transfer: true,
        estimatedTimeMinutes: 3
      }),
      preference: "balanced",
      modifiers: [],
      originFamily: "jeep",
      destinationFamily: "jeep"
    });

    // baseCost=3, transferPenalty=6, hopPenalty=0 (transfer edge)
    expect(weight).toBeGreaterThanOrEqual(3 + 6);
  });
});

describe("getJeepneyPriorityAdjustment", () => {
  it("returns +24 when no jeep legs exist (balanced)", () => {
    const adjustment = getJeepneyPriorityAdjustment({
      preference: "balanced",
      jeepLegCount: 0,
      railLegCount: 2
    });

    expect(adjustment).toBe(24);
  });

  it("returns -7.5 for 1–5 jeep legs (balanced)", () => {
    for (const count of [1, 2, 3, 4, 5]) {
      const adjustment = getJeepneyPriorityAdjustment({
        preference: "balanced",
        jeepLegCount: count,
        railLegCount: 0
      });

      expect(adjustment).toBe(-7.5);
    }
  });

  it("returns positive penalty for >5 jeep legs", () => {
    const adjustment = getJeepneyPriorityAdjustment({
      preference: "balanced",
      jeepLegCount: 7,
      railLegCount: 0
    });

    expect(adjustment).toBe((7 - 5) * 1.8);
  });

  it("returns 0 for fastest preference", () => {
    const adjustment = getJeepneyPriorityAdjustment({
      preference: "fastest",
      jeepLegCount: 0,
      railLegCount: 3
    });

    expect(adjustment).toBe(0);
  });

  it("returns 0 for cheapest preference", () => {
    const adjustment = getJeepneyPriorityAdjustment({
      preference: "cheapest",
      jeepLegCount: 3,
      railLegCount: 1
    });

    expect(adjustment).toBe(0);
  });
});

describe("getTransferMultiplier", () => {
  it("returns 1.0 for non-transfer edges", () => {
    expect(
      getTransferMultiplier({
        isTransfer: false,
        distanceMeters: 0,
        fromLabel: "Doroteo Jose LRT",
        toLabel: "Recto LRT"
      })
    ).toBe(1);
  });

  it("returns 0.65 for known interchange (Doroteo Jose ↔ Recto)", () => {
    expect(
      getTransferMultiplier({
        isTransfer: true,
        distanceMeters: 240,
        fromLabel: "Doroteo Jose LRT",
        toLabel: "Recto LRT"
      })
    ).toBe(0.65);
  });

  it("returns 0.7 for very short transfers (≤35m)", () => {
    expect(
      getTransferMultiplier({
        isTransfer: true,
        distanceMeters: 20,
        fromLabel: "Stop A",
        toLabel: "Stop B"
      })
    ).toBe(0.7);
  });
});

describe("getStopFamily", () => {
  it("returns lrt for lrt mode stop", () => {
    expect(getStopFamily(buildStop({ mode: "lrt1" }))).toBe("lrt");
    expect(getStopFamily(buildStop({ mode: "lrt2" }))).toBe("lrt");
    expect(getStopFamily(buildStop({ mode: "lrt" }))).toBe("lrt");
  });

  it("returns mrt for mrt mode stop", () => {
    expect(getStopFamily(buildStop({ mode: "mrt3" }))).toBe("mrt");
  });

  it("returns jeep for jeepney mode", () => {
    expect(getStopFamily(buildStop({ mode: "jeepney" }))).toBe("jeep");
    expect(getStopFamily(buildStop({ mode: "jeep" }))).toBe("jeep");
  });
});

describe("mapTransitModeToRideMode", () => {
  it("maps generic lrt edges using route labels", () => {
    expect(
      mapTransitModeToRideMode({
        mode: "lrt",
        line: "ROUTE_880747",
        routeShortName: "LRT 1",
        routeLongName: "Baclaran - Roosevelt"
      })
    ).toBe("lrt1");

    expect(
      mapTransitModeToRideMode({
        mode: "lrt",
        line: "ROUTE_880801",
        routeShortName: "LRT 2",
        routeLongName: "Recto - Santolan"
      })
    ).toBe("lrt2");
  });

  it("maps generic mrt edges using route labels", () => {
    expect(
      mapTransitModeToRideMode({
        mode: "mrt",
        line: "ROUTE_880854",
        routeShortName: "MRT-3",
        routeLongName: "Taft Ave - North Ave"
      })
    ).toBe("mrt3");
  });

  it("rejects unsupported generic lrt services like PNR", () => {
    expect(
      mapTransitModeToRideMode({
        mode: "lrt",
        line: "ROUTE_880872",
        routeShortName: "PNR MC",
        routeLongName: "Metro Commuter"
      })
    ).toBeNull();
  });
});
