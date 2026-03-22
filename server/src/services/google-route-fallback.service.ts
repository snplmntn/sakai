import { createHash } from "node:crypto";

import { getEnv } from "../config/env.js";
import * as fareModel from "../models/fare.model.js";
import * as placeModel from "../models/place.model.js";
import * as stopModel from "../models/stop.model.js";
import type { FareBreakdown, FareConfidence, PassengerType } from "../types/fare.js";
import type {
  CommuteMode,
  RouteModifier,
  RouteQueryLeg,
  RouteQueryNormalizedInput,
  RouteQueryOption,
  RouteQueryResult
} from "../types/route-query.js";
import { priceRideLegsWithCatalog, type FareRideLegInput } from "./fare-engine.service.js";
import {
  hasTrainCommutePreference,
  mapRideModeToCommuteMode,
  normalizeCommuteModes,
  usesAllCommuteModes
} from "./route-planner-rules.js";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type GoogleFallbackStatus = RouteQueryResult["googleFallback"]["status"];

interface GoogleFallbackResult {
  status: GoogleFallbackStatus;
  options: RouteQueryOption[];
  message?: string;
}

const GOOGLE_COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const JEEPNEY_FARE_PRODUCT_CODE = "puj_traditional";
const RAIL_ESTIMATE_BASE_FARE: Record<"lrt1" | "lrt2" | "mrt3", number> = {
  lrt1: 20,
  lrt2: 15,
  mrt3: 16
};
const RAIL_ESTIMATE_PER_KM: Record<"lrt1" | "lrt2" | "mrt3", number> = {
  lrt1: 1.2,
  lrt2: 1.5,
  mrt3: 1.3
};

const parseSecondsDuration = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }

  const normalized = value.trim();

  if (!normalized.endsWith("s")) {
    return 0;
  }

  const seconds = Number.parseFloat(normalized.slice(0, -1));
  return Number.isFinite(seconds) ? seconds : 0;
};

const roundMinutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

const roundUpFareAmount = (amount: number) => Math.ceil(Math.max(0, amount));
const roundDistanceKm = (amount: number) => Math.round(amount * 100) / 100;

const readLocalizedText = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const textValue = (value as { text?: unknown }).text;

  if (typeof textValue !== "string") {
    return null;
  }

  const trimmed = textValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildEstimatedFareBreakdown = (input: {
  amount: number;
  fareProductCode?: string | null;
  assumptionText: string;
}): FareBreakdown => ({
  amount: roundUpFareAmount(input.amount),
  pricingType: "estimated",
  fareProductCode: input.fareProductCode ?? null,
  ruleVersionName: null,
  effectivityDate: null,
  isDiscountApplied: false,
  assumptionText: input.assumptionText
});

const inferRailMode = (leg: {
  routeCode: string;
  routeName: string;
  directionLabel: string;
}): "lrt1" | "lrt2" | "mrt3" | null => {
  const normalized = `${leg.routeCode} ${leg.routeName} ${leg.directionLabel}`.toLowerCase();

  if (
    normalized.includes("mrt-3") ||
    normalized.includes("mrt3") ||
    normalized.includes("mrt 3")
  ) {
    return "mrt3";
  }

  if (
    normalized.includes("lrt-2") ||
    normalized.includes("lrt2") ||
    normalized.includes("lrt 2")
  ) {
    return "lrt2";
  }

  if (
    normalized.includes("lrt-1") ||
    normalized.includes("lrt1") ||
    normalized.includes("lrt 1")
  ) {
    return "lrt1";
  }

  return null;
};

const estimateJeepneyFare = (distanceKm: number, passengerType: PassengerType) => {
  const minimumFare = passengerType === "regular" ? 13 : 13;
  const succeedingFare = passengerType === "regular" ? 1.8 : 1.44;

  if (distanceKm <= 4) {
    return minimumFare;
  }

  return minimumFare + Math.ceil(distanceKm - 4) * succeedingFare;
};

const estimateRailFare = (
  distanceKm: number,
  mode: "lrt1" | "lrt2" | "mrt3",
  passengerType: PassengerType
) => {
  const baseFare = RAIL_ESTIMATE_BASE_FARE[mode];
  const perKmFare = RAIL_ESTIMATE_PER_KM[mode];
  const regularAmount = baseFare + Math.max(0, distanceKm - 2) * perKmFare;

  return passengerType === "regular" ? regularAmount : regularAmount * 0.5;
};

const getFareConfidenceFromPricingTypes = (
  pricingTypes: FareBreakdown["pricingType"][]
): FareConfidence => {
  if (pricingTypes.some((pricingType) => pricingType !== "official")) {
    return pricingTypes.every((pricingType) => pricingType !== "official")
      ? "estimated"
      : "partially_estimated";
  }

  return "official";
};

const resolveRailStopId = async (input: {
  stopName: string;
  mode: "lrt1" | "lrt2" | "mrt3";
}) => {
  const resolution = await placeModel
    .resolvePlaceReference({
      query: input.stopName
    })
    .catch(() => ({
      status: "unresolved" as const
    }));

  if (resolution.status !== "resolved") {
    return null;
  }

  const stops = await stopModel.listStopsByPlaceId(resolution.place.id).catch(() => []);
  const matchingStop = stops.find((stop) => stop.mode === input.mode);

  return matchingStop?.id ?? null;
};

const priceLegWithCatalog = (input: {
  fareCatalog: fareModel.ActiveFareCatalog;
  rideLeg: FareRideLegInput;
  passengerType: PassengerType;
}) => {
  try {
    const pricing = priceRideLegsWithCatalog(input.fareCatalog, [input.rideLeg], input.passengerType);
    return pricing.rideLegs[0]?.fare ?? null;
  } catch {
    return null;
  }
};

const enrichFallbackOptionFares = async (input: {
  option: RouteQueryOption;
  fareCatalog: fareModel.ActiveFareCatalog;
  passengerType: PassengerType;
}) => {
  const rideLegs = input.option.legs.filter(
    (leg): leg is Extract<RouteQueryLeg, { type: "ride" }> => leg.type === "ride"
  );

  if (rideLegs.length === 0) {
    return input.option;
  }

  const fareByLegId = new Map<string, FareBreakdown>();
  const unresolvedRideLegs: Array<Extract<RouteQueryLeg, { type: "ride" }>> = [];

  for (const rideLeg of rideLegs) {
    if (rideLeg.mode === "bus") {
      const fare = priceLegWithCatalog({
        fareCatalog: input.fareCatalog,
        rideLeg: {
          id: rideLeg.id,
          mode: "jeepney",
          distanceKm: rideLeg.distanceKm,
          fareProductCode: JEEPNEY_FARE_PRODUCT_CODE,
          fromStopId: `${rideLeg.id}:from`,
          toStopId: `${rideLeg.id}:to`
        },
        passengerType: input.passengerType
      });

      if (fare) {
        fareByLegId.set(rideLeg.id, fare);
        continue;
      }

      unresolvedRideLegs.push(rideLeg);
      continue;
    }

    if (rideLeg.mode !== "rail") {
      unresolvedRideLegs.push(rideLeg);
      continue;
    }

    const railMode = inferRailMode(rideLeg);

    if (!railMode) {
      unresolvedRideLegs.push(rideLeg);
      continue;
    }

    const [fromStopId, toStopId] = await Promise.all([
      resolveRailStopId({
        stopName: rideLeg.fromStop.stopName,
        mode: railMode
      }),
      resolveRailStopId({
        stopName: rideLeg.toStop.stopName,
        mode: railMode
      })
    ]);

    if (!fromStopId || !toStopId) {
      unresolvedRideLegs.push(rideLeg);
      continue;
    }

    const fare = priceLegWithCatalog({
      fareCatalog: input.fareCatalog,
      rideLeg: {
        id: rideLeg.id,
        mode: railMode,
        distanceKm: rideLeg.distanceKm,
        fareProductCode: null,
        fromStopId,
        toStopId
      },
      passengerType: input.passengerType
    });

    if (fare) {
      fareByLegId.set(rideLeg.id, fare);
      continue;
    }

    unresolvedRideLegs.push(rideLeg);
  }

  const mappedTotalFare = [...fareByLegId.values()].reduce((total, fare) => total + fare.amount, 0);
  const unresolvedTotalDistance = unresolvedRideLegs.reduce((total, leg) => total + leg.distanceKm, 0);
  const distributableGoogleFare =
    input.option.totalFare === null ? null : Math.max(0, input.option.totalFare - mappedTotalFare);

  for (const rideLeg of unresolvedRideLegs) {
    if (distributableGoogleFare !== null) {
      const distanceRatio =
        unresolvedTotalDistance > 0 ? rideLeg.distanceKm / unresolvedTotalDistance : 1 / unresolvedRideLegs.length;

      fareByLegId.set(
        rideLeg.id,
        buildEstimatedFareBreakdown({
          amount: distributableGoogleFare * distanceRatio,
          assumptionText: "Allocated from Google Maps total fare after Sakai fare mapping."
        })
      );
      continue;
    }

    if (rideLeg.mode === "bus") {
      fareByLegId.set(
        rideLeg.id,
        buildEstimatedFareBreakdown({
          amount: estimateJeepneyFare(rideLeg.distanceKm, input.passengerType),
          fareProductCode: JEEPNEY_FARE_PRODUCT_CODE,
          assumptionText: "Estimated using Sakai jeepney fare rules because Google total fare was unavailable."
        })
      );
      continue;
    }

    const railMode = inferRailMode(rideLeg) ?? "lrt1";
    fareByLegId.set(
      rideLeg.id,
      buildEstimatedFareBreakdown({
        amount: estimateRailFare(rideLeg.distanceKm, railMode, input.passengerType),
        assumptionText:
          "Estimated rail fare because exact station-to-station matching was unavailable for Sakai pricing."
      })
    );
  }

  const enrichedLegs = input.option.legs.map((leg) => {
    if (leg.type !== "ride") {
      return leg;
    }

    const fare = fareByLegId.get(leg.id);

    return fare
      ? {
          ...leg,
          fare
        }
      : leg;
  });
  const enrichedPricingTypes = enrichedLegs
    .filter((leg): leg is Extract<RouteQueryLeg, { type: "ride" }> => leg.type === "ride")
    .map((leg) => leg.fare.pricingType);
  const enrichedFareAssumptions = [
    ...new Set(
      [
        ...input.option.fareAssumptions,
        ...enrichedLegs
          .filter((leg): leg is Extract<RouteQueryLeg, { type: "ride" }> => leg.type === "ride")
          .map((leg) => leg.fare.assumptionText)
          .filter((assumptionText): assumptionText is string => Boolean(assumptionText))
      ].filter((assumptionText): assumptionText is string => assumptionText.length > 0)
    )
  ];
  const enrichedTotalFare = roundUpFareAmount(
    enrichedLegs.reduce((total, leg) => total + leg.fare.amount, 0)
  );

  return {
    ...input.option,
    legs: enrichedLegs,
    totalFare: enrichedTotalFare,
    fareConfidence: getFareConfidenceFromPricingTypes(enrichedPricingTypes),
    fareAssumptions: enrichedFareAssumptions,
    providerNotice:
      input.option.providerNotice ??
      "Route data is from Google Maps fallback. Fare is enriched with Sakai fare rules when possible."
  };
};

const enrichFallbackOptions = async (input: {
  options: RouteQueryOption[];
  passengerType: PassengerType;
}) => {
  if (input.options.length === 0) {
    return input.options;
  }

  const fareCatalog = await fareModel
    .getActiveFareCatalog(["jeepney", "lrt1", "lrt2", "mrt3"])
    .catch((error: unknown) => {
      console.warn("Failed to load fare catalog for Google fallback enrichment", {
        operation: "google_fallback_fare_catalog",
        reason: error instanceof Error ? error.message : "unknown error"
      });

      return {
        ruleVersions: [],
        fareProducts: [],
        trainStationFares: []
      } satisfies fareModel.ActiveFareCatalog;
    });

  return Promise.all(
    input.options.map((option) =>
      enrichFallbackOptionFares({
        option,
        fareCatalog,
        passengerType: input.passengerType
      })
    )
  );
};

const decodePolyline = (encoded: string): Coordinate[] => {
  const coordinates: Coordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5
    });
  }

  return coordinates;
};

const createZeroFare = (assumptionText: string): FareBreakdown => ({
  amount: 0,
  pricingType: "estimated",
  fareProductCode: null,
  ruleVersionName: null,
  effectivityDate: null,
  isDiscountApplied: false,
  assumptionText
});

const createSyntheticStop = (input: {
  idSeed: string;
  stopName: string;
  latitude: number;
  longitude: number;
  mode: "bus" | "rail";
}) => ({
  id: `google-stop:${createHash("sha1").update(input.idSeed).digest("hex").slice(0, 12)}`,
  placeId: null,
  externalStopCode: null,
  stopName: input.stopName,
  mode: input.mode,
  area: "Google fallback",
  latitude: input.latitude,
  longitude: input.longitude,
  isActive: true,
  createdAt: new Date(0).toISOString()
});

const parseMoneyAmount = (value: unknown): number | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const money = value as {
    units?: unknown;
    nanos?: unknown;
  };
  const units =
    typeof money.units === "string"
      ? Number.parseFloat(money.units)
      : typeof money.units === "number"
        ? money.units
        : 0;
  const nanos = typeof money.nanos === "number" ? money.nanos : 0;

  if (!Number.isFinite(units) || !Number.isFinite(nanos)) {
    return null;
  }

  return roundUpFareAmount(units + nanos / 1_000_000_000);
};

const getModeLabel = (mode: RouteQueryLeg["type"] extends never ? never : string) => {
  switch (mode) {
    case "rail":
      return "Rail";
    case "bus":
      return "Bus";
    default:
      return "Transit";
  }
};

const buildSummary = (legs: RouteQueryLeg[]) => {
  const parts = legs.flatMap((leg) => {
    if (leg.type === "walk") {
      return [`Walk to ${leg.toLabel}`];
    }

    if (leg.type === "drive") {
      return [`Drive to ${leg.toLabel}`];
    }

    return [`${getModeLabel(leg.mode)} via ${leg.routeName}`];
  });

  return parts.slice(0, 3).join(", ");
};

const getRoutingPreference = (modifiers: RouteModifier[]) => {
  if (modifiers.includes("less_walking")) {
    return "LESS_WALKING";
  }

  return "FEWER_TRANSFERS";
};

const dedupeOptions = (options: RouteQueryOption[]) => {
  const optionMap = new Map<string, RouteQueryOption>();

  for (const option of options) {
    const signature = option.legs
      .map((leg) => {
        if (leg.type === "ride") {
          return `ride:${leg.mode}:${leg.routeName}:${leg.fromStop.stopName}:${leg.toStop.stopName}`;
        }

        if (leg.type === "walk") {
          return `walk:${leg.fromLabel}:${leg.toLabel}:${leg.durationMinutes}`;
        }

        return `drive:${leg.fromLabel}:${leg.toLabel}:${leg.durationMinutes}`;
      })
      .join("|");

    if (!optionMap.has(signature)) {
      optionMap.set(signature, option);
    }
  }

  return [...optionMap.values()];
};

const getCommuteModeAlignment = (option: RouteQueryOption, commuteModes: CommuteMode[]) => {
  const preferredModes = new Set(normalizeCommuteModes(commuteModes));
  const applyPreference = preferredModes.size > 0 && !usesAllCommuteModes(commuteModes);
  let preferredRideCount = 0;
  let unpreferredRideCount = 0;

  if (!applyPreference) {
    return {
      preferredRideCount,
      unpreferredRideCount
    };
  }

  for (const leg of option.legs) {
    if (leg.type !== "ride") {
      continue;
    }

    const commuteMode = mapRideModeToCommuteMode(leg.mode, `${leg.routeCode} ${leg.routeName}`);

    if (!commuteMode) {
      continue;
    }

    if (preferredModes.has(commuteMode)) {
      preferredRideCount += 1;
    } else {
      unpreferredRideCount += 1;
    }
  }

  return {
    preferredRideCount,
    unpreferredRideCount
  };
};

const compareGoogleOptions = (
  left: RouteQueryOption,
  right: RouteQueryOption,
  commuteModes: CommuteMode[]
) => {
  const leftAlignment = getCommuteModeAlignment(left, commuteModes);
  const rightAlignment = getCommuteModeAlignment(right, commuteModes);
  const trainPreferred = hasTrainCommutePreference(commuteModes);

  if (trainPreferred) {
    const getTrainMetrics = (option: RouteQueryOption) => {
      let trainRideCount = 0;
      let nonTrainRideCount = 0;

      for (const leg of option.legs) {
        if (leg.type !== "ride") {
          continue;
        }

        const commuteMode = mapRideModeToCommuteMode(leg.mode, `${leg.routeCode} ${leg.routeName}`);

        if (commuteMode === "train") {
          trainRideCount += 1;
        } else {
          nonTrainRideCount += 1;
        }
      }

      return {
        trainRideCount,
        nonTrainRideCount
      };
    };
    const leftTrainMetrics = getTrainMetrics(left);
    const rightTrainMetrics = getTrainMetrics(right);
    const trainComparison =
      leftTrainMetrics.nonTrainRideCount - rightTrainMetrics.nonTrainRideCount ||
      rightTrainMetrics.trainRideCount - leftTrainMetrics.trainRideCount;

    if (trainComparison !== 0) {
      return trainComparison;
    }
  }

  return (
    leftAlignment.unpreferredRideCount - rightAlignment.unpreferredRideCount ||
    rightAlignment.preferredRideCount - leftAlignment.preferredRideCount ||
    left.totalDurationMinutes - right.totalDurationMinutes ||
    left.transferCount - right.transferCount ||
    (left.totalFare ?? Number.MAX_SAFE_INTEGER) - (right.totalFare ?? Number.MAX_SAFE_INTEGER) ||
    left.summary.localeCompare(right.summary)
  );
};

const buildFallbackOption = (input: {
  normalizedQuery: RouteQueryNormalizedInput;
  route: unknown;
  index: number;
}): RouteQueryOption | null => {
  if (typeof input.route !== "object" || input.route === null) {
    return null;
  }

  const route = input.route as {
    duration?: string;
    distanceMeters?: unknown;
    polyline?: { encodedPolyline?: unknown };
    travelAdvisory?: { transitFare?: unknown };
    legs?: unknown;
  };

  const routeLeg = Array.isArray(route.legs) ? route.legs[0] : null;

  if (typeof routeLeg !== "object" || routeLeg === null) {
    return null;
  }

  const steps = Array.isArray((routeLeg as { steps?: unknown }).steps)
    ? ((routeLeg as { steps: unknown[] }).steps)
    : [];

  const legs: RouteQueryLeg[] = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];

    if (typeof step !== "object" || step === null) {
      continue;
    }

    const typedStep = step as {
      travelMode?: unknown;
      distanceMeters?: unknown;
      staticDuration?: unknown;
      polyline?: { encodedPolyline?: unknown };
      startLocation?: { latLng?: { latitude?: unknown; longitude?: unknown } };
      endLocation?: { latLng?: { latitude?: unknown; longitude?: unknown } };
      transitDetails?: {
        headsign?: unknown;
        stopDetails?: {
          departureStop?: { name?: unknown };
          arrivalStop?: { name?: unknown };
        };
        transitLine?: {
          name?: unknown;
          nameShort?: unknown;
          vehicle?: {
            type?: unknown;
            name?: unknown;
          };
        };
      };
      navigationInstruction?: {
        instructions?: unknown;
      };
    };

    const encodedPolyline =
      typeof typedStep.polyline?.encodedPolyline === "string"
        ? typedStep.polyline.encodedPolyline
        : null;
    const pathCoordinates =
      encodedPolyline && encodedPolyline.length > 0 ? decodePolyline(encodedPolyline) : undefined;
    const stepSeconds =
      typeof typedStep.staticDuration === "string" ? parseSecondsDuration(typedStep.staticDuration) : 0;

    if (typedStep.travelMode === "WALK") {
      const instruction =
        typeof typedStep.navigationInstruction?.instructions === "string"
          ? typedStep.navigationInstruction.instructions
          : "Next stop";
      legs.push({
        type: "walk",
        id: `google-walk:${input.index}:${index}`,
        fromLabel: index === 0 ? input.normalizedQuery.origin.label : "Transfer",
        toLabel: instruction,
        distanceMeters:
          typeof typedStep.distanceMeters === "number" ? typedStep.distanceMeters : 0,
        durationMinutes: roundMinutes(stepSeconds),
        fare: createZeroFare("Walk legs are free."),
        pathCoordinates
      });
      continue;
    }

    const departureLat =
      typeof typedStep.startLocation?.latLng?.latitude === "number"
        ? typedStep.startLocation.latLng.latitude
        : input.normalizedQuery.origin.latitude;
    const departureLng =
      typeof typedStep.startLocation?.latLng?.longitude === "number"
        ? typedStep.startLocation.latLng.longitude
        : input.normalizedQuery.origin.longitude;
    const arrivalLat =
      typeof typedStep.endLocation?.latLng?.latitude === "number"
        ? typedStep.endLocation.latLng.latitude
        : input.normalizedQuery.destination.latitude;
    const arrivalLng =
      typeof typedStep.endLocation?.latLng?.longitude === "number"
        ? typedStep.endLocation.latLng.longitude
        : input.normalizedQuery.destination.longitude;
    const lineName =
      readLocalizedText(typedStep.transitDetails?.transitLine?.nameShort) ??
      readLocalizedText(typedStep.transitDetails?.transitLine?.name) ??
      "Google transit";
    const vehicleType =
      typeof typedStep.transitDetails?.transitLine?.vehicle?.type === "string"
        ? typedStep.transitDetails.transitLine.vehicle.type.toUpperCase()
        : "";
    const mode: "bus" | "rail" =
      vehicleType.includes("RAIL") ||
      vehicleType.includes("SUBWAY") ||
      vehicleType.includes("TRAIN") ||
      lineName.toLowerCase().includes("mrt") ||
      lineName.toLowerCase().includes("lrt")
        ? "rail"
        : "bus";
    const fromName =
      readLocalizedText(typedStep.transitDetails?.stopDetails?.departureStop?.name) ?? "Boarding stop";
    const toName =
      readLocalizedText(typedStep.transitDetails?.stopDetails?.arrivalStop?.name) ?? "Alighting stop";
    const headsign =
      typeof typedStep.transitDetails?.headsign === "string"
        ? typedStep.transitDetails.headsign
        : lineName;

    legs.push({
      type: "ride",
      id: `google-ride:${input.index}:${index}`,
      mode,
      routeId: `google:${lineName}`,
      routeVariantId: `google:${lineName}:${headsign}`,
      routeVariantCode: headsign,
      routeCode: lineName,
      routeName: lineName,
      directionLabel: headsign,
      fromStop: createSyntheticStop({
        idSeed: `${lineName}:${fromName}:${departureLat}:${departureLng}`,
        stopName: fromName,
        latitude: departureLat,
        longitude: departureLng,
        mode
      }),
      toStop: createSyntheticStop({
        idSeed: `${lineName}:${toName}:${arrivalLat}:${arrivalLng}`,
        stopName: toName,
        latitude: arrivalLat,
        longitude: arrivalLng,
        mode
      }),
      routeLabel: lineName,
      distanceKm:
        typeof typedStep.distanceMeters === "number" ? roundDistanceKm(typedStep.distanceMeters / 1000) : 0,
      durationMinutes: roundMinutes(stepSeconds),
      corridorTags: [],
      fare: createZeroFare("Leg-level fare is not available for Google fallback routes."),
      pathCoordinates
    });
  }

  if (legs.length === 0) {
    return null;
  }

  const totalFare = parseMoneyAmount(route.travelAdvisory?.transitFare);
  const providerNotice =
    totalFare === null
      ? "Route data is from Google Maps fallback. A fare estimate was not available for this route."
      : "Route data is from Google Maps fallback. Fare is estimated and not ranked by Sakai.";
  const rideLegs = legs.filter((leg): leg is Extract<RouteQueryLeg, { type: "ride" }> => leg.type === "ride");
  const lastRideLeg = rideLegs.at(-1);

  return {
    id: `google-fallback:${input.index}`,
    summary: buildSummary(legs),
    recommendationLabel: "Google fallback option",
    highlights: [],
    totalDurationMinutes:
      typeof route.duration === "string"
        ? roundMinutes(parseSecondsDuration(route.duration))
        : legs.reduce((total, leg) => total + leg.durationMinutes, 0),
    totalFare,
    fareConfidence: "estimated",
    transferCount: Math.max(0, rideLegs.length - 1),
    corridorTags: [],
    fareAssumptions:
      totalFare === null
        ? ["Google Maps did not provide a usable transit fare estimate for this route."]
        : ["Fare estimate comes from Google Maps fallback and may differ from Sakai fare rules."],
    legs,
    relevantIncidents: [],
    routeCommunity: [],
    navigationTarget: lastRideLeg
      ? {
          latitude: lastRideLeg.toStop.latitude,
          longitude: lastRideLeg.toStop.longitude,
          label: lastRideLeg.toStop.stopName,
          kind: "dropoff_stop"
        }
      : {
          latitude: input.normalizedQuery.destination.latitude,
          longitude: input.normalizedQuery.destination.longitude,
          label: input.normalizedQuery.destination.label,
          kind: "destination"
        },
    source: "google_fallback",
    providerLabel: "Google Maps fallback",
    providerNotice
  };
};

export const queryGoogleFallbackRoutes = async (input: {
  normalizedQuery: RouteQueryNormalizedInput;
  modifiers: RouteModifier[];
  commuteModes: CommuteMode[];
  passengerType: PassengerType;
}): Promise<GoogleFallbackResult> => {
  const apiKey = getEnv().GOOGLE_MAPS_SERVER_API_KEY?.trim() ?? "";

  if (apiKey.length === 0) {
    return {
      status: "unavailable",
      options: [],
      message: "Google Maps fallback is unavailable right now."
    };
  }

  const response = await fetch(GOOGLE_COMPUTE_ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.transitFare,routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.startLocation.latLng.latitude,routes.legs.steps.startLocation.latLng.longitude,routes.legs.steps.endLocation.latLng.latitude,routes.legs.steps.endLocation.latLng.longitude,routes.legs.steps.transitDetails.headsign,routes.legs.steps.transitDetails.stopDetails.departureStop.name,routes.legs.steps.transitDetails.stopDetails.arrivalStop.name,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.nameShort,routes.legs.steps.transitDetails.transitLine.vehicle.type"
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: input.normalizedQuery.origin.latitude,
            longitude: input.normalizedQuery.origin.longitude
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: input.normalizedQuery.destination.latitude,
            longitude: input.normalizedQuery.destination.longitude
          }
        }
      },
      travelMode: "TRANSIT",
      computeAlternativeRoutes: true,
      transitPreferences: {
        routingPreference: getRoutingPreference(input.modifiers)
      },
      languageCode: "en",
      units: "METRIC"
    })
  }).catch((error: unknown) => {
    console.warn("Google fallback route request failed", {
      operation: "google_fallback_route_request",
      reason: error instanceof Error ? error.message : "unknown error"
    });

    return null;
  });

  if (!response) {
    return {
      status: "unavailable",
      options: [],
      message: "Google Maps fallback is unavailable right now."
    };
  }

  if (!response.ok) {
    console.warn("Google fallback route request returned a non-success status", {
      operation: "google_fallback_route_request",
      status: response.status
    });

    return {
      status: "unavailable",
      options: [],
      message: "Google Maps fallback is unavailable right now."
    };
  }

  const body = (await response.json().catch(() => null)) as { routes?: unknown } | null;
  const routes = Array.isArray(body?.routes) ? body.routes : [];
  const parsedOptions = dedupeOptions(
    routes.flatMap((route, index) => {
      const option = buildFallbackOption({
        normalizedQuery: input.normalizedQuery,
        route,
        index
      });

      return option ? [option] : [];
    })
  );
  const enrichedOptions = await enrichFallbackOptions({
    options: parsedOptions,
    passengerType: input.passengerType
  });
  const options = dedupeOptions(enrichedOptions).sort((left, right) =>
    compareGoogleOptions(left, right, input.commuteModes)
  );

  if (options.length === 0) {
    return {
      status: "no_results",
      options: [],
      message: `Google Maps did not return fallback transit routes for ${input.normalizedQuery.origin.label} to ${input.normalizedQuery.destination.label}.`
    };
  }

  return {
    status: "available",
    options
  };
};
