import type { PassengerType } from "../types/fare.js";

export interface RailStationManifestEntry {
  stationIndex: number;
  externalStopCode: string;
  canonicalName: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  aliases: readonly string[];
}

export interface GeneratedTrainStationFare {
  originStopCode: string;
  destinationStopCode: string;
  regularFare: number;
  discountedFare: number;
}

const DISCOUNTED_PASSENGER_TYPES: readonly PassengerType[] = ["student", "senior", "pwd"];

const roundUpFareAmount = (value: number) => Math.ceil(Math.max(0, value));

const normalizeStationName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ");

const resolveDiscountMultiplier = (passengerType: PassengerType) =>
  DISCOUNTED_PASSENGER_TYPES.includes(passengerType) ? 0.5 : 1;

export const LRT1_STATION_MANIFEST: readonly RailStationManifestEntry[] = [
  {
    stationIndex: 1,
    externalStopCode: "LRT1-01",
    canonicalName: "Dr. Santos",
    city: "Paranaque",
    area: "Paranaque",
    latitude: 14.4849,
    longitude: 120.9931,
    aliases: ["Dr Santos", "Sucat"]
  },
  {
    stationIndex: 2,
    externalStopCode: "LRT1-02",
    canonicalName: "Ninoy Aquino Avenue",
    city: "Paranaque",
    area: "Paranaque",
    latitude: 14.49178,
    longitude: 120.99273,
    aliases: ["NAIA Avenue", "Ninoy Aquino Ave"]
  },
  {
    stationIndex: 3,
    externalStopCode: "LRT1-03",
    canonicalName: "Asia World",
    city: "Paranaque",
    area: "Paranaque",
    latitude: 14.49867,
    longitude: 120.99236,
    aliases: ["Asiaworld"]
  },
  {
    stationIndex: 4,
    externalStopCode: "LRT1-04",
    canonicalName: "MIA Road",
    city: "Paranaque",
    area: "Paranaque",
    latitude: 14.50555,
    longitude: 120.99199,
    aliases: ["Mia Road"]
  },
  {
    stationIndex: 5,
    externalStopCode: "LRT1-05",
    canonicalName: "PITX",
    city: "Paranaque",
    area: "Paranaque",
    latitude: 14.51244,
    longitude: 120.99163,
    aliases: ["Paranaque Integrated Terminal Exchange"]
  },
  {
    stationIndex: 6,
    externalStopCode: "LRT1-06",
    canonicalName: "Redemptorist-Aseana",
    city: "Paranaque",
    area: "Paranaque",
    latitude: 14.51932,
    longitude: 120.99126,
    aliases: ["Redemptorist", "Aseana"]
  },
  {
    stationIndex: 7,
    externalStopCode: "LRT1-07",
    canonicalName: "Baclaran",
    city: "Pasay",
    area: "Pasay",
    latitude: 14.5262,
    longitude: 120.99089,
    aliases: ["Baclaran Station"]
  },
  {
    stationIndex: 8,
    externalStopCode: "LRT1-08",
    canonicalName: "EDSA",
    city: "Pasay",
    area: "Pasay",
    latitude: 14.53309,
    longitude: 120.99052,
    aliases: ["EDSA-Taft", "Taft"]
  },
  {
    stationIndex: 9,
    externalStopCode: "LRT1-09",
    canonicalName: "Libertad",
    city: "Pasay",
    area: "Pasay",
    latitude: 14.53997,
    longitude: 120.99015,
    aliases: ["Arnaiz"]
  },
  {
    stationIndex: 10,
    externalStopCode: "LRT1-10",
    canonicalName: "Gil Puyat",
    city: "Pasay",
    area: "Pasay",
    latitude: 14.54686,
    longitude: 120.98978,
    aliases: ["Buendia"]
  },
  {
    stationIndex: 11,
    externalStopCode: "LRT1-11",
    canonicalName: "Vito Cruz",
    city: "Pasay",
    area: "Pasay",
    latitude: 14.55374,
    longitude: 120.98942,
    aliases: ["P. Ocampo"]
  },
  {
    stationIndex: 12,
    externalStopCode: "LRT1-12",
    canonicalName: "Quirino",
    city: "Manila",
    area: "Manila",
    latitude: 14.56062,
    longitude: 120.98905,
    aliases: ["Quirino Avenue"]
  },
  {
    stationIndex: 13,
    externalStopCode: "LRT1-13",
    canonicalName: "Pedro Gil",
    city: "Manila",
    area: "Manila",
    latitude: 14.56751,
    longitude: 120.98868,
    aliases: []
  },
  {
    stationIndex: 14,
    externalStopCode: "LRT1-14",
    canonicalName: "United Nations",
    city: "Manila",
    area: "Manila",
    latitude: 14.57439,
    longitude: 120.98831,
    aliases: ["United Nations Avenue", "UN Avenue"]
  },
  {
    stationIndex: 15,
    externalStopCode: "LRT1-15",
    canonicalName: "Central Terminal",
    city: "Manila",
    area: "Manila",
    latitude: 14.58128,
    longitude: 120.98794,
    aliases: ["Central"]
  },
  {
    stationIndex: 16,
    externalStopCode: "LRT1-16",
    canonicalName: "Carriedo",
    city: "Manila",
    area: "Manila",
    latitude: 14.58816,
    longitude: 120.98758,
    aliases: []
  },
  {
    stationIndex: 17,
    externalStopCode: "LRT1-17",
    canonicalName: "Doroteo Jose",
    city: "Manila",
    area: "Manila",
    latitude: 14.59504,
    longitude: 120.98721,
    aliases: ["Doroteo Jose Station"]
  },
  {
    stationIndex: 18,
    externalStopCode: "LRT1-18",
    canonicalName: "Bambang",
    city: "Manila",
    area: "Manila",
    latitude: 14.60193,
    longitude: 120.98684,
    aliases: []
  },
  {
    stationIndex: 19,
    externalStopCode: "LRT1-19",
    canonicalName: "Tayuman",
    city: "Manila",
    area: "Manila",
    latitude: 14.60881,
    longitude: 120.98647,
    aliases: []
  },
  {
    stationIndex: 20,
    externalStopCode: "LRT1-20",
    canonicalName: "Blumentritt",
    city: "Manila",
    area: "Manila",
    latitude: 14.6157,
    longitude: 120.9861,
    aliases: []
  },
  {
    stationIndex: 21,
    externalStopCode: "LRT1-21",
    canonicalName: "Abad Santos",
    city: "Manila",
    area: "Manila",
    latitude: 14.62258,
    longitude: 120.98574,
    aliases: []
  },
  {
    stationIndex: 22,
    externalStopCode: "LRT1-22",
    canonicalName: "R. Papa",
    city: "Manila",
    area: "Manila",
    latitude: 14.62946,
    longitude: 120.98537,
    aliases: ["R Papa"]
  },
  {
    stationIndex: 23,
    externalStopCode: "LRT1-23",
    canonicalName: "5th Avenue",
    city: "Caloocan",
    area: "Caloocan",
    latitude: 14.63635,
    longitude: 120.985,
    aliases: ["Fifth Avenue"]
  },
  {
    stationIndex: 24,
    externalStopCode: "LRT1-24",
    canonicalName: "Monumento",
    city: "Caloocan",
    area: "Caloocan",
    latitude: 14.64323,
    longitude: 120.98463,
    aliases: []
  },
  {
    stationIndex: 25,
    externalStopCode: "LRT1-25",
    canonicalName: "Balintawak",
    city: "Quezon City",
    area: "Quezon City",
    latitude: 14.65012,
    longitude: 120.98426,
    aliases: []
  },
  {
    stationIndex: 26,
    externalStopCode: "LRT1-26",
    canonicalName: "Fernando Poe Jr.",
    city: "Quezon City",
    area: "Quezon City",
    latitude: 14.657,
    longitude: 120.9839,
    aliases: ["FPJ", "Roosevelt"]
  }
] as const;

export const LRT2_STATION_MANIFEST: readonly RailStationManifestEntry[] = [
  {
    stationIndex: 1,
    externalStopCode: "LRT2-01",
    canonicalName: "Recto",
    city: "Manila",
    area: "Manila",
    latitude: 14.6038,
    longitude: 120.986,
    aliases: ["D. Jose", "Doroteo Jose"]
  },
  {
    stationIndex: 2,
    externalStopCode: "LRT2-02",
    canonicalName: "Legarda",
    city: "Manila",
    area: "Manila",
    latitude: 14.60594,
    longitude: 120.99725,
    aliases: []
  },
  {
    stationIndex: 3,
    externalStopCode: "LRT2-03",
    canonicalName: "Pureza",
    city: "Manila",
    area: "Manila",
    latitude: 14.60808,
    longitude: 121.0085,
    aliases: []
  },
  {
    stationIndex: 4,
    externalStopCode: "LRT2-04",
    canonicalName: "V. Mapa",
    city: "Manila",
    area: "Manila",
    latitude: 14.61022,
    longitude: 121.01975,
    aliases: ["V Mapa"]
  },
  {
    stationIndex: 5,
    externalStopCode: "LRT2-05",
    canonicalName: "J. Ruiz",
    city: "San Juan",
    area: "San Juan",
    latitude: 14.61237,
    longitude: 121.031,
    aliases: ["J Ruiz"]
  },
  {
    stationIndex: 6,
    externalStopCode: "LRT2-06",
    canonicalName: "Gilmore",
    city: "Quezon City",
    area: "Quezon City",
    latitude: 14.61451,
    longitude: 121.04225,
    aliases: []
  },
  {
    stationIndex: 7,
    externalStopCode: "LRT2-07",
    canonicalName: "Betty Go-Belmonte",
    city: "Quezon City",
    area: "Quezon City",
    latitude: 14.61665,
    longitude: 121.0535,
    aliases: ["Betty Go"]
  },
  {
    stationIndex: 8,
    externalStopCode: "LRT2-08",
    canonicalName: "Araneta Center-Cubao",
    city: "Quezon City",
    area: "Quezon City",
    latitude: 14.61879,
    longitude: 121.06475,
    aliases: ["Cubao", "Araneta Cubao"]
  },
  {
    stationIndex: 9,
    externalStopCode: "LRT2-09",
    canonicalName: "Anonas",
    city: "Quezon City",
    area: "Quezon City",
    latitude: 14.62093,
    longitude: 121.076,
    aliases: []
  },
  {
    stationIndex: 10,
    externalStopCode: "LRT2-10",
    canonicalName: "Katipunan",
    city: "Quezon City",
    area: "Quezon City",
    latitude: 14.62307,
    longitude: 121.08725,
    aliases: []
  },
  {
    stationIndex: 11,
    externalStopCode: "LRT2-11",
    canonicalName: "Santolan",
    city: "Marikina",
    area: "Marikina",
    latitude: 14.62522,
    longitude: 121.0985,
    aliases: []
  },
  {
    stationIndex: 12,
    externalStopCode: "LRT2-12",
    canonicalName: "Marikina-Pasig",
    city: "Marikina",
    area: "Marikina",
    latitude: 14.62736,
    longitude: 121.10975,
    aliases: ["Marikina"]
  },
  {
    stationIndex: 13,
    externalStopCode: "LRT2-13",
    canonicalName: "Antipolo",
    city: "Antipolo",
    area: "Antipolo",
    latitude: 14.6295,
    longitude: 121.121,
    aliases: ["Masinag"]
  }
] as const;

const resolveStationEntry = (
  stationName: string,
  manifest: readonly RailStationManifestEntry[]
) => {
  const normalizedStationName = normalizeStationName(stationName);

  const station =
    manifest.find((entry) => normalizeStationName(entry.canonicalName) === normalizedStationName) ??
    manifest.find((entry) =>
      entry.aliases.some((alias) => normalizeStationName(alias) === normalizedStationName)
    );

  if (!station) {
    throw new Error(`Unknown station ${stationName}`);
  }

  return station;
};

export const calculateLrt1Fare = (
  fromStationIndex: number,
  toStationIndex: number,
  passengerType: PassengerType = "regular"
) => {
  const stationsTraveled = Math.abs(toStationIndex - fromStationIndex);

  if (stationsTraveled === 0) {
    return 0;
  }

  const regularFare = 20 + (stationsTraveled - 1);
  return roundUpFareAmount(regularFare * resolveDiscountMultiplier(passengerType));
};

export const calculateLrt2SliceFare = (
  fromStationName: string,
  toStationName: string,
  passengerType: PassengerType = "regular"
) => {
  const relevantManifest = LRT2_STATION_MANIFEST.filter((station) => station.stationIndex <= 3);
  const fromStation = resolveStationEntry(fromStationName, relevantManifest);
  const toStation = resolveStationEntry(toStationName, relevantManifest);

  if (fromStation.stationIndex === toStation.stationIndex) {
    return 0;
  }

  const segmentFareByStartIndex = new Map<number, number>([
    [1, 13],
    [2, 15]
  ]);
  const lowerBound = Math.min(fromStation.stationIndex, toStation.stationIndex);
  const upperBound = Math.max(fromStation.stationIndex, toStation.stationIndex);
  let regularFare = 0;

  for (let stationIndex = lowerBound; stationIndex < upperBound; stationIndex += 1) {
    regularFare += segmentFareByStartIndex.get(stationIndex) ?? 0;
  }

  return roundUpFareAmount(regularFare * resolveDiscountMultiplier(passengerType));
};

export const buildLrt1TrainStationFares = (): GeneratedTrainStationFare[] =>
  LRT1_STATION_MANIFEST.flatMap((originStation) =>
    LRT1_STATION_MANIFEST
      .filter((destinationStation) => destinationStation.stationIndex !== originStation.stationIndex)
      .map((destinationStation) => {
        const regularFare = calculateLrt1Fare(
          originStation.stationIndex,
          destinationStation.stationIndex,
          "regular"
        );

        return {
          originStopCode: originStation.externalStopCode,
          destinationStopCode: destinationStation.externalStopCode,
          regularFare,
          discountedFare: calculateLrt1Fare(
            originStation.stationIndex,
            destinationStation.stationIndex,
            "student"
          )
        };
      })
  );

export const buildLrt2SliceTrainStationFares = (): GeneratedTrainStationFare[] => {
  const relevantManifest = LRT2_STATION_MANIFEST.filter((station) => station.stationIndex <= 3);

  return relevantManifest.flatMap((originStation) =>
    relevantManifest
      .filter((destinationStation) => destinationStation.stationIndex !== originStation.stationIndex)
      .map((destinationStation) => ({
        originStopCode: originStation.externalStopCode,
        destinationStopCode: destinationStation.externalStopCode,
        regularFare: calculateLrt2SliceFare(
          originStation.canonicalName,
          destinationStation.canonicalName,
          "regular"
        ),
        discountedFare: calculateLrt2SliceFare(
          originStation.canonicalName,
          destinationStation.canonicalName,
          "student"
        )
      }))
  );
};
