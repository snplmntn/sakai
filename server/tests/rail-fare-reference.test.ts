import { describe, expect, it } from "vitest";

import {
  LRT1_STATION_MANIFEST,
  LRT2_STATION_MANIFEST,
  buildLrt1TrainStationFares,
  buildLrt2SliceTrainStationFares,
  calculateLrt1Fare,
  calculateLrt2SliceFare
} from "../src/services/rail-fare-reference.js";

describe("rail fare reference", () => {
  it("calculates LRT-1 fares by stations traveled with a 50 percent discount for eligible riders", () => {
    expect(calculateLrt1Fare(7, 7)).toBe(0);
    expect(calculateLrt1Fare(7, 8)).toBe(20);
    expect(calculateLrt1Fare(1, 6)).toBe(24);
    expect(calculateLrt1Fare(6, 1)).toBe(24);
    expect(calculateLrt1Fare(7, 8, "student")).toBe(10);
    expect(calculateLrt1Fare(1, 6, "pwd")).toBe(12);
  });

  it("generates a full directed LRT-1 fare matrix", () => {
    const fares = buildLrt1TrainStationFares();

    expect(fares).toHaveLength(LRT1_STATION_MANIFEST.length * (LRT1_STATION_MANIFEST.length - 1));
    expect(fares).toContainEqual({
      originStopCode: "LRT1-07",
      destinationStopCode: "LRT1-08",
      regularFare: 20,
      discountedFare: 10
    });
    expect(fares).toContainEqual({
      originStopCode: "LRT1-01",
      destinationStopCode: "LRT1-06",
      regularFare: 24,
      discountedFare: 12
    });
  });

  it("calculates the provided LRT-2 demo slice with D. Jose mapped to Recto", () => {
    expect(calculateLrt2SliceFare("Recto", "Recto")).toBe(0);
    expect(calculateLrt2SliceFare("D. Jose", "Legarda")).toBe(13);
    expect(calculateLrt2SliceFare("Recto", "Pureza")).toBe(28);
    expect(calculateLrt2SliceFare("Pureza", "Recto")).toBe(28);
    expect(calculateLrt2SliceFare("D. Jose", "Pureza", "senior")).toBe(14);
    expect(calculateLrt2SliceFare("Legarda", "Recto", "pwd")).toBe(6.5);
  });

  it("generates only the directed fare rows covered by the provided LRT-2 formula slice", () => {
    const fares = buildLrt2SliceTrainStationFares();

    expect(LRT2_STATION_MANIFEST.filter((station) => station.stationIndex <= 3)).toHaveLength(3);
    expect(fares).toHaveLength(6);
    expect(fares).toContainEqual({
      originStopCode: "LRT2-01",
      destinationStopCode: "LRT2-02",
      regularFare: 13,
      discountedFare: 6.5
    });
    expect(fares).toContainEqual({
      originStopCode: "LRT2-01",
      destinationStopCode: "LRT2-03",
      regularFare: 28,
      discountedFare: 14
    });
  });
});
