import { createHash } from "node:crypto";

import {
  AiInvalidResponseError,
  AiUnavailableError
} from "../ai/client.js";
import { parseRouteIntent } from "../ai/intent-parser.js";
import { generateRouteSummary } from "../ai/route-summary.js";
import type { RouteIntent } from "../ai/types.js";
import * as fareModel from "../models/fare.model.js";
import * as placeModel from "../models/place.model.js";
import * as routeModel from "../models/route.model.js";
import * as stopModel from "../models/stop.model.js";
import * as transferPointModel from "../models/transfer-point.model.js";
import * as userPreferenceModel from "../models/user-preference.model.js";
import { buildRouteCommunityMetadataLookup } from "../models/community-review.model.js";
import { HttpError } from "../types/http-error.js";
import type { FareBreakdown, PassengerType } from "../types/fare.js";
import type { PlaceMatch, RouteLeg, RouteVariant, Stop, StopMode, TransferPoint } from "../types/route-network.js";
import type {
  CommuteMode,
  RouteModifier,
  RouteQueryDriveLeg,
  RouteQueryLeg,
  RouteQueryNormalizedInput,
  RouteQueryOption,
  RouteQueryPointInput,
  RouteQueryResult,
  RouteQueryRideLeg,
  RouteQueryValueSource,
  RouteQueryWalkLeg
} from "../types/route-query.js";
import type { RoutePreference } from "../models/user-preference.model.js";
import { priceRideLegsWithCatalog, type FareRideLegInput } from "./fare-engine.service.js";
import {
  buildPlannerCandidateMetrics,
  buildRuntimeManualTransferPoints,
  DEFAULT_COMMUTE_MODES,
  dominatesPlannerCandidate
} from "./route-planner-rules.js";
import { attachRelevantIncidentsToOptions } from "./route-incident.service.js";
import { rankRouteOptions } from "./route-ranking.service.js";
import { queryTransitRoutesIfPossible } from "./transit-route-query.service.js";
import { queryGoogleFallbackRoutes } from "./google-route-fallback.service.js";

const DEFAULT_ROUTE_PREFERENCE: RoutePreference = "balanced";
const DEFAULT_PASSENGER_TYPE: PassengerType = "regular";
const DEFAULT_ALLOW_CAR_ACCESS = false;
const MAX_WALK_ACCESS_DISTANCE_METERS = 500;
const MAX_DRIVE_ACCESS_DISTANCE_METERS = 3_000;
const MAX_WALK_ACCESS_STOPS = 5;
const MAX_DRIVE_ACCESS_STOPS = 5;
const MAX_ROUTE_SLICES_PER_STOP = 10;
const MAX_QUEUED_MULTIMODAL_STATES = 500;
const MAX_CANDIDATE_DRAFTS = 200;
const MAX_ROUTE_OPTIONS = 3;
const ROUTE_SUMMARY_CONCURRENCY = 3;
const WALKING_METERS_PER_MINUTE = 80;
const DRIVING_METERS_PER_MINUTE = 250;
const RIDE_STOP_MODES: StopMode[] = ["jeepney", "uv", "mrt3", "lrt1", "lrt2", "tricycle", "car"];
const MAX_RIDE_LEGS_PER_OPTION = 4;
const fallbackWarningKeys = new Set<string>();

interface RouteQueryRequest {
  origin?: RouteQueryPointInput;
  originFallback?: RouteQueryPointInput;
  destination?: RouteQueryPointInput;
  queryText?: string;
  preference?: RoutePreference;
  passengerType?: PassengerType;
  modifiers?: RouteModifier[];
  commuteModes?: CommuteMode[];
  allowCarAccess?: boolean;
}

interface EffectiveValue<T> {
  value: T;
  source: RouteQueryValueSource;
}

interface AccessStopCandidate {
  stop: Stop;
  distanceMeters: number;
  durationMinutes: number;
  accessMode: "walk" | "drive";
}

interface EndpointResolution {
  place: PlaceMatch;
  accessStops: AccessStopCandidate[];
}

interface RouteSlice {
  variant: RouteVariant;
  fromStop: Stop;
  toStop: Stop;
  legs: RouteLeg[];
  fareProductCode: string | null;
  distanceKm: number;
  durationMinutes: number;
  corridorTags: string[];
}

interface CandidateDraft {
  signature: string;
  rideLegs: RouteSlice[];
  transitionLegs: Array<{
    id: string;
    mode: "walk" | "drive";
    fromLabel: string;
    toLabel: string;
    distanceMeters: number;
    durationMinutes: number;
  }>;
}

interface ParsedRouteQueryContext {
  intent: RouteIntent | null;
  origin?: RouteQueryPointInput;
  destination?: RouteQueryPointInput;
}

interface MultimodalPathState {
  currentStopId: string;
  rideLegs: RouteSlice[];
  transferLabels: string[];
  transitionLegs: CandidateDraft["transitionLegs"];
  visitedStopIds: Set<string>;
}

const warnOnce = (key: string, message: string, details: Record<string, unknown>) => {
  if (fallbackWarningKeys.has(key)) {
    return;
  }

  fallbackWarningKeys.add(key);
  console.warn(message, details);
};

const roundMinutes = (value: number) => Math.ceil(value);

const createWalkFareBreakdown = (): FareBreakdown => ({
  amount: 0,
  pricingType: "official",
  fareProductCode: null,
  ruleVersionName: null,
  effectivityDate: null,
  isDiscountApplied: false,
  assumptionText: null
});

const buildRouteOptionId = (signature: string) =>
  createHash("sha1").update(signature).digest("hex").slice(0, 16);

const buildNavigationTarget = (input: {
  normalizedQuery: RouteQueryNormalizedInput;
  legs: RouteQueryLeg[];
}) => {
  const rideLegs = input.legs.filter(
    (leg): leg is RouteQueryRideLeg => leg.type === "ride"
  );
  const lastRideLeg = rideLegs.at(-1);

  if (lastRideLeg) {
    return {
      latitude: lastRideLeg.toStop.latitude,
      longitude: lastRideLeg.toStop.longitude,
      label: lastRideLeg.toStop.stopName,
      kind: "dropoff_stop" as const
    };
  }

  return {
    latitude: input.normalizedQuery.destination.latitude,
    longitude: input.normalizedQuery.destination.longitude,
    label: input.normalizedQuery.destination.label,
    kind: "destination" as const
  };
};

const sortAccessStops = (accessStops: AccessStopCandidate[]) =>
  [...accessStops].sort(
    (left, right) =>
      left.distanceMeters - right.distanceMeters ||
      left.durationMinutes - right.durationMinutes ||
      left.stop.stopName.localeCompare(right.stop.stopName) ||
      left.stop.id.localeCompare(right.stop.id)
  );

const getClarificationField = (input: {
  origin?: RouteQueryPointInput;
  destination?: RouteQueryPointInput;
}) => {
  if (!input.origin && !input.destination) {
    return "both" as const;
  }

  if (!input.origin) {
    return "origin" as const;
  }

  return "destination" as const;
};

const buildClarificationError = (details: {
  field: "origin" | "destination" | "both";
  matches?: PlaceMatch[];
  originMatches?: PlaceMatch[];
  destinationMatches?: PlaceMatch[];
}) =>
  new HttpError(400, "Route query needs clarification", {
    reasonCode: "clarification_required",
    ...details
  });

const isRecoverableIntentError = (
  error: unknown
): error is AiUnavailableError | AiInvalidResponseError =>
  error instanceof AiUnavailableError || error instanceof AiInvalidResponseError;

const parseQueryText = async (
  request: RouteQueryRequest
): Promise<ParsedRouteQueryContext> => {
  if (!request.queryText) {
    return {
      intent: null,
      origin: request.origin ?? request.originFallback,
      destination: request.destination
    };
  }

  try {
    const intent = await parseRouteIntent(request.queryText);
    const resolvedOrigin =
      request.origin ??
      (intent.originText ? { label: intent.originText } : undefined) ??
      request.originFallback;
    const resolvedDestination =
      request.destination ??
      (intent.destinationText ? { label: intent.destinationText } : undefined);

    if (intent.requiresClarification) {
      const missingOrigin = !resolvedOrigin;
      const missingDestination = !resolvedDestination;

      if (missingOrigin || missingDestination) {
        throw buildClarificationError({
          field:
            missingOrigin && missingDestination
              ? "both"
              : missingOrigin
                ? "origin"
                : "destination"
        });
      }
    }

    return {
      intent,
      origin: resolvedOrigin,
      destination: resolvedDestination
    };
  } catch (error) {
    if (!isRecoverableIntentError(error)) {
      throw error;
    }

    console.warn("Unable to parse route query text with AI", {
      operation: "intent_parser",
      reason: error.message
    });

    if ((request.origin ?? request.originFallback) && request.destination) {
      return {
        intent: null,
        origin: request.origin ?? request.originFallback,
        destination: request.destination
      };
    }

    throw new HttpError(503, "Route query parsing is temporarily unavailable", {
      reasonCode: "ai_temporarily_unavailable"
    });
  }
};

const getEffectivePreferenceValues = async (input: {
  userId?: string;
  accessToken?: string;
  preference?: RoutePreference;
  passengerType?: PassengerType;
  modifiers?: RouteModifier[];
  commuteModes?: CommuteMode[];
  allowCarAccess?: boolean;
  parsedPreference?: RoutePreference | null;
  parsedPassengerType?: PassengerType | null;
  parsedModifiers?: RouteModifier[];
  parsedCommuteModes?: CommuteMode[] | null;
  parsedAllowCarAccess?: boolean | null;
}): Promise<{
  preference: EffectiveValue<RoutePreference>;
  passengerType: EffectiveValue<PassengerType>;
  modifiers: EffectiveValue<RouteModifier[]>;
  commuteModes: EffectiveValue<CommuteMode[]>;
  allowCarAccess: EffectiveValue<boolean>;
}> => {
  const savedPreference = input.userId
    ? await userPreferenceModel.getUserPreferenceByUserId(
        input.userId,
        input.accessToken
      )
    : null;

  return {
    preference: input.preference
      ? {
          value: input.preference,
          source: "request_override"
        }
      : input.parsedPreference
        ? {
            value: input.parsedPreference,
            source: "ai_parsed"
          }
        : savedPreference
          ? {
              value: savedPreference.defaultPreference,
              source: "saved_preference"
            }
          : {
              value: DEFAULT_ROUTE_PREFERENCE,
              source: "default"
            },
    passengerType: input.passengerType
      ? {
          value: input.passengerType,
          source: "request_override"
        }
      : input.parsedPassengerType
        ? {
            value: input.parsedPassengerType,
            source: "ai_parsed"
          }
        : savedPreference
          ? {
              value: savedPreference.passengerType,
              source: "saved_preference"
            }
          : {
              value: DEFAULT_PASSENGER_TYPE,
              source: "default"
            },
    modifiers: input.modifiers
      ? {
          value: [...new Set(input.modifiers)],
          source: "request_override"
        }
      : input.parsedModifiers && input.parsedModifiers.length > 0
        ? {
            value: [...new Set(input.parsedModifiers)],
            source: "ai_parsed"
          }
        : {
            value: [],
            source: "default"
          },
    commuteModes: input.commuteModes
      ? {
          value: [...new Set(input.commuteModes)],
          source: "request_override"
        }
      : input.parsedCommuteModes && input.parsedCommuteModes.length > 0
        ? {
            value: [...new Set(input.parsedCommuteModes)],
            source: "ai_parsed"
          }
        : {
            value: [...DEFAULT_COMMUTE_MODES],
            source: "default"
          },
    allowCarAccess:
      typeof input.allowCarAccess === "boolean"
        ? {
            value: input.allowCarAccess,
            source: "request_override"
          }
        : typeof input.parsedAllowCarAccess === "boolean"
          ? {
              value: input.parsedAllowCarAccess,
              source: "ai_parsed"
            }
          : {
              value: DEFAULT_ALLOW_CAR_ACCESS,
              source: "default"
            }
  };
};

const filterAccessStopsForCarPreference = (
  accessStops: AccessStopCandidate[],
  allowCarAccess: boolean
) =>
  allowCarAccess
    ? accessStops
    : accessStops.filter((accessStop) => accessStop.accessMode === "walk");

const getCoordinatesFromPoint = (point: RouteQueryPointInput) =>
  typeof point.latitude === "number" && typeof point.longitude === "number"
    ? {
        latitude: point.latitude,
        longitude: point.longitude
      }
    : null;

const buildAccessStopCandidate = (
  stop: Stop,
  distanceMeters: number,
  accessMode: "walk" | "drive"
): AccessStopCandidate => ({
  stop,
  distanceMeters,
  durationMinutes: roundMinutes(
    distanceMeters /
      (accessMode === "walk" ? WALKING_METERS_PER_MINUTE : DRIVING_METERS_PER_MINUTE)
  ),
  accessMode
});

const buildCoordinateResolvedPlace = (
  field: "origin" | "destination",
  point: RouteQueryPointInput
): PlaceMatch | null => {
  const coordinates = getCoordinatesFromPoint(point);

  if (!coordinates) {
    return null;
  }

  const label =
    point.label?.trim() ||
    (field === "origin" ? "Selected origin" : "Selected destination");
  const coordinateId = `coords:${field}:${coordinates.latitude.toFixed(6)}:${coordinates.longitude.toFixed(6)}`;

  return {
    id: coordinateId,
    canonicalName: label,
    city: "Metro Manila",
    kind: "area",
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    googlePlaceId: null,
    createdAt: "1970-01-01T00:00:00.000Z",
    matchedBy: "coordinates",
    matchedText: label
  };
};

const isSyntheticCoordinatePlaceId = (placeId: string) => placeId.startsWith("coords:");
const isTransitClusterPlaceId = (placeId: string) => placeId.startsWith("cluster:");

const buildPointFromResolvedPlace = (
  point: RouteQueryPointInput,
  place: Pick<PlaceMatch, "id" | "canonicalName" | "latitude" | "longitude">
): RouteQueryPointInput => ({
  placeId: place.id,
  label: place.canonicalName,
  latitude: point.latitude ?? place.latitude,
  longitude: point.longitude ?? place.longitude
});

const listNearbyRideAccessStops = async (point: RouteQueryPointInput) => {
  const coordinates = getCoordinatesFromPoint(point);

  if (!coordinates) {
    return [];
  }

  let nearbyStops;

  try {
    nearbyStops = await stopModel.findNearestStops({
      coordinates,
      limit: 40,
      modes: RIDE_STOP_MODES,
      maxDistanceMeters: MAX_DRIVE_ACCESS_DISTANCE_METERS
    });
  } catch (error) {
    if (stopModel.isStopsAccessUnavailableError(error)) {
      warnOnce("route_query_stop_access_fallback", "Stop access lookup unavailable during route query", {
        operation: "route_query_stop_access_fallback",
        reason: error instanceof Error ? error.message : "unknown error"
      });
      return [];
    }

    throw error;
  }

  return nearbyStops
    .filter((nearbyStop) => nearbyStop.distanceMeters <= MAX_DRIVE_ACCESS_DISTANCE_METERS)
    .map((nearbyStop) =>
      buildAccessStopCandidate(
        nearbyStop,
        nearbyStop.distanceMeters,
        nearbyStop.distanceMeters <= MAX_WALK_ACCESS_DISTANCE_METERS ? "walk" : "drive"
      )
    );
};

const resolvePlaceFromNearbyStops = async (input: {
  point: RouteQueryPointInput;
  nearbyStops: Awaited<ReturnType<typeof listNearbyRideAccessStops>>;
}) => {
  const nearestStopWithPlace = input.nearbyStops.find((nearbyStop) => Boolean(nearbyStop.stop.placeId));

  if (!nearestStopWithPlace?.stop.placeId) {
    return null;
  }

  const place = await placeModel.getPlaceById(nearestStopWithPlace.stop.placeId);

  if (!place) {
    return null;
  }

  const coordinates = getCoordinatesFromPoint(input.point);

  return {
    ...place,
    matchedBy: "coordinates" as const,
    matchedText:
      input.point.label ??
      (coordinates
        ? `${coordinates.latitude},${coordinates.longitude}`
        : nearestStopWithPlace.stop.stopName)
  };
};

const resolveEndpoint = async (
  field: "origin" | "destination",
  point: RouteQueryPointInput,
  options?: {
    queryText?: string;
  }
): Promise<EndpointResolution> => {
  let resolution = await placeModel.resolvePlaceReference({
    placeId: point.placeId,
    googlePlaceId: point.googlePlaceId,
    query: point.label
  });
  let nearbyStops = await listNearbyRideAccessStops(point);

  if (
    nearbyStops.length === 0 &&
    resolution.status === "resolved" &&
    !getCoordinatesFromPoint(point)
  ) {
    nearbyStops = await listNearbyRideAccessStops(buildPointFromResolvedPlace(point, resolution.place));
  }

  if (resolution.status === "unresolved" && nearbyStops.length > 0) {
    const nearbyPlace = await resolvePlaceFromNearbyStops({
      point,
      nearbyStops
    });

    if (nearbyPlace) {
      resolution = {
        status: "resolved",
        place: nearbyPlace
      };
    }
  }

  if (resolution.status === "unresolved") {
    const coordinateResolvedPlace = buildCoordinateResolvedPlace(field, point);

    if (coordinateResolvedPlace) {
      resolution = {
        status: "resolved",
        place: coordinateResolvedPlace
      };
    }
  }

  if (resolution.status === "unresolved") {
    if (options?.queryText) {
      throw buildClarificationError({
        field
      });
    }

    throw new HttpError(422, `${field} could not be resolved`, {
      field,
      status: "unresolved"
    });
  }

  if (resolution.status === "ambiguous") {
    if (options?.queryText) {
      throw buildClarificationError({
        field,
        matches: resolution.matches
      });
    }

    throw new HttpError(422, `${field} matches multiple supported places`, {
      field,
      status: "ambiguous",
      matches: resolution.matches
    });
  }

  const accessStopMap = new Map<string, AccessStopCandidate>();
  const shouldLoadPlaceLinkedStops =
    !isSyntheticCoordinatePlaceId(resolution.place.id) &&
    !isTransitClusterPlaceId(resolution.place.id);

  if (shouldLoadPlaceLinkedStops) {
    try {
      for (const stop of await stopModel.listStopsByPlaceId(resolution.place.id)) {
        accessStopMap.set(stop.id, buildAccessStopCandidate(stop, 0, "walk"));
      }
    } catch (error) {
      if (stopModel.isStopsAccessUnavailableError(error)) {
        warnOnce("route_query_place_stop_fallback", "Place-linked stop lookup unavailable during route query", {
          operation: "route_query_place_stop_fallback",
          reason: error instanceof Error ? error.message : "unknown error",
          placeId: resolution.place.id
        });
      } else {
        throw error;
      }
    }
  }

  const walkCandidates: AccessStopCandidate[] = [];
  const driveCandidates: AccessStopCandidate[] = [];

  for (const nearbyStop of nearbyStops) {
    if (nearbyStop.accessMode === "walk") {
      walkCandidates.push(nearbyStop);
    } else {
      driveCandidates.push(nearbyStop);
    }
  }

  for (const candidate of sortAccessStops(walkCandidates).slice(0, MAX_WALK_ACCESS_STOPS)) {
    accessStopMap.set(candidate.stop.id, candidate);
  }

  for (const candidate of sortAccessStops(driveCandidates).slice(0, MAX_DRIVE_ACCESS_STOPS)) {
    if (!accessStopMap.has(candidate.stop.id)) {
      accessStopMap.set(candidate.stop.id, candidate);
    }
  }

  return {
    place: resolution.place,
    accessStops: sortAccessStops([...accessStopMap.values()])
  };
};

const getUniformFareProductCode = (routeLegs: RouteLeg[]) => {
  const fareProductCodes = [...new Set(routeLegs.map((routeLeg) => routeLeg.fareProductCode).filter(Boolean))];

  if (fareProductCodes.length > 1) {
    throw new HttpError(
      500,
      `Route variant ${routeLegs[0]?.routeVariantId ?? "unknown"} mixes fare products within one ride segment`
    );
  }

  return fareProductCodes[0] ?? null;
};

const buildRouteSlice = (variant: RouteVariant, startIndex: number, endIndex: number): RouteSlice => {
  const legs = variant.legs.slice(startIndex, endIndex + 1);

  if (legs.length === 0) {
    throw new HttpError(500, `Cannot build an empty route slice for variant ${variant.id}`);
  }

  return {
    variant,
    fromStop: legs[0].fromStop,
    toStop: legs[legs.length - 1].toStop,
    legs,
    fareProductCode: getUniformFareProductCode(legs),
    distanceKm: Number(legs.reduce((total, leg) => total + leg.distanceKm, 0).toFixed(2)),
    durationMinutes: legs.reduce((total, leg) => total + leg.durationMinutes, 0),
    corridorTags: [...new Set(legs.map((leg) => leg.corridorTag))]
  };
};

const listRouteSlicesFromStopIds = (variants: RouteVariant[], startStopIds?: Set<string>) => {
  const routeSlicesByFromStopId = new Map<string, RouteSlice[]>();

  for (const variant of variants) {
    for (let startIndex = 0; startIndex < variant.legs.length; startIndex += 1) {
      const fromStopId = variant.legs[startIndex]?.fromStop.id;

      if (!fromStopId) {
        continue;
      }

      if (startStopIds && !startStopIds.has(fromStopId)) {
        continue;
      }

      for (let endIndex = startIndex; endIndex < variant.legs.length; endIndex += 1) {
        const slice = buildRouteSlice(variant, startIndex, endIndex);
        const existingSlices = routeSlicesByFromStopId.get(fromStopId) ?? [];

        existingSlices.push(slice);
        routeSlicesByFromStopId.set(fromStopId, existingSlices);
      }
    }
  }

  for (const slices of routeSlicesByFromStopId.values()) {
    slices.sort(
      (left, right) =>
        left.durationMinutes - right.durationMinutes ||
        left.toStop.stopName.localeCompare(right.toStop.stopName) ||
        left.toStop.id.localeCompare(right.toStop.id)
    );

    if (slices.length > MAX_ROUTE_SLICES_PER_STOP) {
      slices.splice(MAX_ROUTE_SLICES_PER_STOP);
    }
  }

  return routeSlicesByFromStopId;
};

const listRouteSlicesFromAccessStops = (
  variants: RouteVariant[],
  accessStopIds: Set<string>
): RouteSlice[] => {
  const routeSlicesByFromStopId = listRouteSlicesFromStopIds(variants, accessStopIds);

  return [...routeSlicesByFromStopId.values()].flat();
};

const buildCandidateSignatureFromRidePath = (input: {
  rideLegs: RouteSlice[];
  transferLabels: string[];
  transitionLegs: CandidateDraft["transitionLegs"];
}) =>
  buildCandidateSignature([
    ...input.transitionLegs.map(
      (transitionLeg) =>
        `${transitionLeg.id}:${transitionLeg.mode}:${transitionLeg.fromLabel}:${transitionLeg.toLabel}:${transitionLeg.distanceMeters}`
    ),
    ...input.rideLegs.flatMap((rideLeg, rideIndex) => {
      const signaturePart = `${rideLeg.variant.id}:${rideLeg.fromStop.id}:${rideLeg.toStop.id}`;

      if (rideIndex >= input.transferLabels.length) {
        return [signaturePart];
      }

      return [signaturePart, input.transferLabels[rideIndex]];
    })
  ]);

const buildCandidateDraftForDestination = (
  input: {
    rideLegs: RouteSlice[];
    transitionLegs: CandidateDraft["transitionLegs"];
    transferLabels: string[];
    destinationLabel: string;
  },
  destinationAccessMap: Map<string, AccessStopCandidate>
): CandidateDraft | null => {
  const lastStopId = input.rideLegs.at(-1)?.toStop.id;

  if (!lastStopId) {
    return null;
  }

  const destinationAccess = destinationAccessMap.get(lastStopId);

  if (!destinationAccess) {
    return null;
  }

  const transitionLegs: CandidateDraft["transitionLegs"] = [...input.transitionLegs];

  if (destinationAccess.distanceMeters > 0) {
    transitionLegs.push({
      id: `egress:${lastStopId}`,
      mode: destinationAccess.accessMode,
      fromLabel: input.rideLegs.at(-1)?.toStop.stopName ?? lastStopId,
      toLabel: input.destinationLabel,
      distanceMeters: destinationAccess.distanceMeters,
      durationMinutes: destinationAccess.durationMinutes
    });
  }

  return {
    signature: buildCandidateSignatureFromRidePath({
      rideLegs: input.rideLegs,
      transferLabels: input.transferLabels,
      transitionLegs
    }),
    rideLegs: input.rideLegs,
    transitionLegs
  };
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const getFarePricingType = (
  trustLevel: fareModel.ActiveFareCatalog["ruleVersions"][number]["trustLevel"]
) => {
  if (trustLevel === "official") {
    return "official" as const;
  }

  if (trustLevel === "estimated") {
    return "estimated" as const;
  }

  return "community_estimated" as const;
};

const getFareConfidenceFromPricingTypes = (pricingTypes: Array<FareBreakdown["pricingType"]>) => {
  if (pricingTypes.length === 0 || pricingTypes.every((pricingType) => pricingType === "official")) {
    return "official" as const;
  }

  if (pricingTypes.every((pricingType) => pricingType !== "official")) {
    return "estimated" as const;
  }

  return "partially_estimated" as const;
};

const buildDriveFareBreakdown = (
  fareCatalog: fareModel.ActiveFareCatalog,
  driveLeg: CandidateDraft["transitionLegs"][number]
): FareBreakdown => {
  const ruleVersion = fareCatalog.ruleVersions.find((entry) => entry.mode === "car");
  const fareProduct = fareCatalog.fareProducts.find((entry) => entry.mode === "car");

  if (!ruleVersion || !fareProduct) {
    throw new HttpError(500, "Missing active fare rules for mode car");
  }

  const distanceKm = driveLeg.distanceMeters / 1_000;
  const billableDistanceKm = Math.max(0, distanceKm - fareProduct.minimumDistanceKm);
  const amount = roundCurrency(
    fareProduct.minimumFareRegular + billableDistanceKm * fareProduct.succeedingFareRegular
  );

  return {
    amount,
    pricingType: getFarePricingType(ruleVersion.trustLevel),
    fareProductCode: fareProduct.productCode,
    ruleVersionName: ruleVersion.versionName,
    effectivityDate: ruleVersion.effectivityDate,
    isDiscountApplied: false,
    assumptionText: fareProduct.notes
  };
};

const buildMultimodalCandidateDrafts = (input: {
  variants: RouteVariant[];
  originSlices: RouteSlice[];
  originAccessMap: Map<string, AccessStopCandidate>;
  destinationAccessMap: Map<string, AccessStopCandidate>;
  transferPoints: TransferPoint[];
  originLabel: string;
  destinationLabel: string;
  preference: RoutePreference;
  modifiers: RouteModifier[];
  commuteModes: CommuteMode[];
}): CandidateDraft[] => {
  const stopById = new Map<string, Stop>();
  const routeSlicesByFromStopId = listRouteSlicesFromStopIds(input.variants);
  const queue: MultimodalPathState[] = [];
  const destinationCandidates: CandidateDraft[] = [];
  const stopNameById = new Map<string, string>();
  let inaccessibleTransferCount = 0;
  let queueCapHit = false;
  let candidateCapHit = false;
  const enqueueState = (state: MultimodalPathState) => {
    if (queue.length < MAX_QUEUED_MULTIMODAL_STATES) {
      queue.push(state);
    } else {
      queueCapHit = true;
    }
  };
  const pushDestinationCandidate = (draft: CandidateDraft | null) => {
    if (draft && destinationCandidates.length < MAX_CANDIDATE_DRAFTS) {
      destinationCandidates.push(draft);
    } else if (draft) {
      candidateCapHit = true;
    }
  };

  for (const variant of input.variants) {
    for (const leg of variant.legs) {
      stopNameById.set(leg.fromStop.id, leg.fromStop.stopName);
      stopNameById.set(leg.toStop.id, leg.toStop.stopName);
      stopById.set(leg.fromStop.id, leg.fromStop);
      stopById.set(leg.toStop.id, leg.toStop);
    }
  }

  for (const stopId of input.originAccessMap.keys()) {
    const accessCandidate = input.originAccessMap.get(stopId);

    if (accessCandidate) {
      stopNameById.set(accessCandidate.stop.id, accessCandidate.stop.stopName);
      stopById.set(accessCandidate.stop.id, accessCandidate.stop);
    }
  }

  for (const stopId of input.destinationAccessMap.keys()) {
    const accessCandidate = input.destinationAccessMap.get(stopId);

    if (accessCandidate) {
      stopNameById.set(accessCandidate.stop.id, accessCandidate.stop.stopName);
      stopById.set(accessCandidate.stop.id, accessCandidate.stop);
    }
  }

  const transferMap = buildTransferMapByFromStopId([
    ...input.transferPoints,
    ...buildRuntimeManualTransferPoints([...stopById.values()])
  ]);

  const pushOriginState = (firstSlice: RouteSlice) => {
    const originAccess = input.originAccessMap.get(firstSlice.fromStop.id);

    if (!originAccess) {
      return;
    }

    const transitionLegs: CandidateDraft["transitionLegs"] = [];

    if (originAccess.distanceMeters > 0) {
      transitionLegs.push({
        id: `access:${firstSlice.fromStop.id}`,
        mode: originAccess.accessMode,
        fromLabel: input.originLabel,
        toLabel: firstSlice.fromStop.stopName,
        distanceMeters: originAccess.distanceMeters,
        durationMinutes: originAccess.durationMinutes
      });
    }

    const state: MultimodalPathState = {
      currentStopId: firstSlice.toStop.id,
      rideLegs: [firstSlice],
      transferLabels: [],
      transitionLegs,
      visitedStopIds: new Set([firstSlice.fromStop.id, firstSlice.toStop.id])
    };

    pushDestinationCandidate(buildCandidateDraftForDestination(
      {
        rideLegs: state.rideLegs,
        transitionLegs: state.transitionLegs,
        transferLabels: state.transferLabels,
        destinationLabel: input.destinationLabel,
      },
      input.destinationAccessMap
    ));

    enqueueState(state);
  };

  for (const firstSlice of input.originSlices) {
    pushOriginState(firstSlice);
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const currentState = queue[queueIndex];

    if (!currentState) {
      continue;
    }

    if (currentState.rideLegs.length >= MAX_RIDE_LEGS_PER_OPTION) {
      continue;
    }

    const transferPoints = transferMap.get(currentState.currentStopId) ?? [];
    const transferWalkIndex = currentState.rideLegs.length - 1;

    for (const transferPoint of transferPoints) {
      if (!transferPoint.isAccessible) {
        inaccessibleTransferCount += 1;
        continue;
      }

      if (
        transferPoint.toStopId !== currentState.currentStopId &&
        currentState.visitedStopIds.has(transferPoint.toStopId)
      ) {
        continue;
      }

      const nextTransitionLegs: CandidateDraft["transitionLegs"] = [
        ...currentState.transitionLegs,
        {
          id: `transfer:${transferWalkIndex}`,
          mode: "walk",
          fromLabel: stopNameById.get(currentState.currentStopId) ?? currentState.currentStopId,
          toLabel: stopNameById.get(transferPoint.toStopId) ?? transferPoint.toStopId,
          distanceMeters: transferPoint.walkingDistanceM,
          durationMinutes: transferPoint.walkingDurationMinutes
        }
      ];

      const nextTransferLabels = [
        ...currentState.transferLabels,
        `${transferPoint.fromStopId}:${transferPoint.toStopId}`
      ];

      pushDestinationCandidate(buildCandidateDraftForDestination(
        {
          rideLegs: currentState.rideLegs,
          transitionLegs: nextTransitionLegs,
          transferLabels: nextTransferLabels,
          destinationLabel: input.destinationLabel
        },
        input.destinationAccessMap
      ));

      const nextSlices = routeSlicesByFromStopId.get(transferPoint.toStopId) ?? [];

      for (const nextSlice of nextSlices) {
        if (currentState.visitedStopIds.has(nextSlice.toStop.id)) {
          continue;
        }

        const nextVisitedStopIds = new Set(currentState.visitedStopIds);
        nextVisitedStopIds.add(nextSlice.toStop.id);
        const nextRideLegs = [...currentState.rideLegs, nextSlice];

        pushDestinationCandidate(buildCandidateDraftForDestination(
          {
            rideLegs: nextRideLegs,
            transitionLegs: nextTransitionLegs,
            transferLabels: nextTransferLabels,
            destinationLabel: input.destinationLabel
          },
          input.destinationAccessMap
        ));

        enqueueState({
          currentStopId: nextSlice.toStop.id,
          rideLegs: nextRideLegs,
          transferLabels: nextTransferLabels,
          transitionLegs: nextTransitionLegs,
          visitedStopIds: nextVisitedStopIds
        });
      }
    }
  }

  if (inaccessibleTransferCount > 0) {
    console.warn("Skipped inaccessible transfer candidates during route composition", {
      operation: "route_query_transfer_filter",
      count: inaccessibleTransferCount
    });
  }

  if (queueCapHit || candidateCapHit) {
    console.warn("Route composition hit planner caps", {
      operation: "route_query_cap",
      queueCapHit,
      candidateCapHit,
      queuedStates: queue.length,
      candidateDrafts: destinationCandidates.length
    });
  }

  return dedupeCandidateDrafts(destinationCandidates, {
    preference: input.preference,
    modifiers: input.modifiers,
    commuteModes: input.commuteModes
  }).slice(0, MAX_CANDIDATE_DRAFTS);
};

const buildTransferMapByFromStopId = (transferPoints: TransferPoint[]) => {
  const transferMap = new Map<string, TransferPoint[]>();
  const seenTransferKeys = new Set<string>();

  for (const transferPoint of transferPoints) {
    if (!transferPoint.isAccessible) {
      continue;
    }

    const transferKey = `${transferPoint.fromStopId}:${transferPoint.toStopId}`;

    if (seenTransferKeys.has(transferKey)) {
      continue;
    }

    seenTransferKeys.add(transferKey);

    const existingTransfers = transferMap.get(transferPoint.fromStopId) ?? [];

    existingTransfers.push(transferPoint);
    transferMap.set(transferPoint.fromStopId, existingTransfers);
  }

  for (const transfers of transferMap.values()) {
    transfers.sort(
      (left, right) =>
        left.walkingDurationMinutes - right.walkingDurationMinutes ||
        left.walkingDistanceM - right.walkingDistanceM ||
        left.toStopId.localeCompare(right.toStopId)
    );
  }

  return transferMap;
};

const buildStopAccessMap = (accessStops: AccessStopCandidate[]) =>
  new Map(accessStops.map((accessStop) => [accessStop.stop.id, accessStop]));

const buildCandidateSignature = (parts: string[]) => parts.join("|");

const buildWalkLeg = (input: {
  id: string;
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  durationMinutes: number;
}): RouteQueryWalkLeg => ({
  type: "walk",
  id: input.id,
  fromLabel: input.fromLabel,
  toLabel: input.toLabel,
  distanceMeters: input.distanceMeters,
  durationMinutes: input.durationMinutes,
  fare: createWalkFareBreakdown()
});

const buildDriveLeg = (input: {
  id: string;
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  durationMinutes: number;
  fare: FareBreakdown;
}): RouteQueryDriveLeg => ({
  type: "drive",
  id: input.id,
  mode: "car",
  fromLabel: input.fromLabel,
  toLabel: input.toLabel,
  distanceKm: Number((input.distanceMeters / 1_000).toFixed(2)),
  durationMinutes: input.durationMinutes,
  fare: input.fare
});

const buildRouteQueryRideLeg = (
  rideLeg: RouteSlice,
  fare: FareBreakdown
): RouteQueryRideLeg => ({
  type: "ride",
  id: `${rideLeg.variant.id}:${rideLeg.fromStop.id}:${rideLeg.toStop.id}`,
  mode: rideLeg.variant.route.primaryMode,
  routeId: rideLeg.variant.route.id,
  routeVariantId: rideLeg.variant.id,
  routeVariantCode: rideLeg.variant.code,
  routeCode: rideLeg.variant.route.code,
  routeName: rideLeg.variant.route.displayName,
  directionLabel: rideLeg.variant.directionLabel,
  fromStop: rideLeg.fromStop,
  toStop: rideLeg.toStop,
  routeLabel: rideLeg.variant.displayName,
  distanceKm: rideLeg.distanceKm,
  durationMinutes: rideLeg.durationMinutes,
  corridorTags: rideLeg.corridorTags,
  fare
});

const buildRouteOption = (
  draft: CandidateDraft,
  fareCatalog: fareModel.ActiveFareCatalog,
  passengerType: PassengerType,
  initialRecommendationLabel: string,
  normalizedQuery: RouteQueryNormalizedInput
): RouteQueryOption => {
  const pricedRideLegs = priceRideLegsWithCatalog(
    fareCatalog,
    draft.rideLegs.map(
      (rideLeg): FareRideLegInput => ({
        id: `${rideLeg.variant.id}:${rideLeg.fromStop.id}:${rideLeg.toStop.id}`,
        mode: rideLeg.variant.route.primaryMode,
        distanceKm: rideLeg.distanceKm,
        fareProductCode: rideLeg.fareProductCode,
        fromStopId: rideLeg.fromStop.id,
        toStopId: rideLeg.toStop.id
      })
    ),
    passengerType
  );
  const fareByRideLegId = new Map(
    pricedRideLegs.rideLegs.map((pricedRideLeg) => [pricedRideLeg.id, pricedRideLeg.fare])
  );
  const driveTransitionLegs = draft.transitionLegs.filter(
    (transitionLeg) => transitionLeg.mode === "drive"
  );
  const driveFareById = new Map(
    driveTransitionLegs.map((driveLeg) => [driveLeg.id, buildDriveFareBreakdown(fareCatalog, driveLeg)])
  );
  const legs: RouteQueryLeg[] = [];

  for (const transitionLeg of draft.transitionLegs) {
    if (transitionLeg.id.startsWith("access:")) {
      legs.push(
        transitionLeg.mode === "walk"
          ? buildWalkLeg(transitionLeg)
          : buildDriveLeg({
              ...transitionLeg,
              fare:
                driveFareById.get(transitionLeg.id) ??
                buildDriveFareBreakdown(fareCatalog, transitionLeg)
            })
      );
    }
  }

  for (let rideIndex = 0; rideIndex < draft.rideLegs.length; rideIndex += 1) {
    const rideLeg = draft.rideLegs[rideIndex];
    const fare = fareByRideLegId.get(`${rideLeg.variant.id}:${rideLeg.fromStop.id}:${rideLeg.toStop.id}`);

    if (!fare) {
      throw new HttpError(500, `Missing fare for route leg ${rideLeg.variant.id}`);
    }

    legs.push(buildRouteQueryRideLeg(rideLeg, fare));

    const transferWalkLeg = draft.transitionLegs.find(
      (transitionLeg) => transitionLeg.id === `transfer:${rideIndex}`
    );

    if (transferWalkLeg) {
      legs.push(buildWalkLeg(transferWalkLeg));
    }
  }

  for (const transitionLeg of draft.transitionLegs) {
    if (transitionLeg.id.startsWith("egress:")) {
      legs.push(
        transitionLeg.mode === "walk"
          ? buildWalkLeg(transitionLeg)
          : buildDriveLeg({
              ...transitionLeg,
              fare:
                driveFareById.get(transitionLeg.id) ??
                buildDriveFareBreakdown(fareCatalog, transitionLeg)
            })
      );
    }
  }

  const driveFares = [...driveFareById.values()];
  const pricingTypes = [
    ...pricedRideLegs.rideLegs.map((pricedRideLeg) => pricedRideLeg.fare.pricingType),
    ...driveFares.map((fare) => fare.pricingType)
  ];
  const totalFare = roundCurrency(
    pricedRideLegs.totalFare + driveFares.reduce((total, fare) => total + fare.amount, 0)
  );
  const fareAssumptions = [
    ...pricedRideLegs.fareAssumptions,
    ...driveFares
      .map((fare) => fare.assumptionText)
      .filter((assumptionText): assumptionText is string => Boolean(assumptionText))
  ];

  return {
    id: buildRouteOptionId(draft.signature),
    summary: "",
    recommendationLabel: initialRecommendationLabel,
    highlights: [],
    totalDurationMinutes: legs.reduce((total, leg) => total + leg.durationMinutes, 0),
    totalFare,
    fareConfidence: getFareConfidenceFromPricingTypes(pricingTypes),
    transferCount: Math.max(0, draft.rideLegs.length - 1),
    corridorTags: [...new Set(draft.rideLegs.flatMap((rideLeg) => rideLeg.corridorTags))],
    fareAssumptions: [...new Set(fareAssumptions)],
    legs,
    relevantIncidents: [],
    routeCommunity: [],
    source: "sakai",
    navigationTarget: buildNavigationTarget({
      normalizedQuery,
      legs
    })
  };
};

const buildRouteQueryMessage = (normalizedQuery: RouteQueryNormalizedInput) =>
  `No supported route found for ${normalizedQuery.origin.label} to ${normalizedQuery.destination.label} in the current coverage`;

const createSkippedGoogleFallback = (): RouteQueryResult["googleFallback"] => ({
  status: "skipped",
  options: []
});

const attachRouteCommunityMetadata = async (
  options: RouteQueryOption[]
): Promise<RouteQueryOption[]> => {
  const rideLegs = options.flatMap((option) =>
    option.legs.filter((leg): leg is RouteQueryRideLeg => leg.type === "ride")
  );

  if (rideLegs.length === 0) {
    return options.map((option) => ({
      ...option,
      routeCommunity: []
    }));
  }

  const metadataLookup = await buildRouteCommunityMetadataLookup({
    routeIds: rideLegs.map((leg) => leg.routeId),
    routeCodes: rideLegs.map((leg) => leg.routeCode),
    routeVariantIds: rideLegs.map((leg) => leg.routeVariantId),
    routeVariantCodes: rideLegs.flatMap((leg) => (leg.routeVariantCode ? [leg.routeVariantCode] : []))
  });

  return options.map((option) => {
    const nextLegs = option.legs.map((leg) => {
      if (leg.type !== "ride") {
        return leg;
      }

      const community =
        metadataLookup.get(`variant-id:${leg.routeVariantId}`) ??
        (leg.routeVariantCode ? metadataLookup.get(`variant-code:${leg.routeVariantCode}`) : undefined) ??
        metadataLookup.get(`route-id:${leg.routeId}`) ??
        metadataLookup.get(`route-code:${leg.routeCode}`);

      return community
        ? {
            ...leg,
            community
          }
        : leg;
    });

    return {
      ...option,
      legs: nextLegs,
      routeCommunity: nextLegs
        .filter((leg): leg is RouteQueryRideLeg => leg.type === "ride" && Boolean(leg.community))
        .map((leg) => leg.community!)
        .filter(
          (community, index, items) =>
            items.findIndex(
              (candidate) =>
                candidate.routeId === community.routeId &&
                candidate.routeVariantId === community.routeVariantId &&
                candidate.routeCode === community.routeCode
            ) === index
        )
    };
  });
};

const normalizeRouteSignatureText = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");

const buildRideSequenceSignature = (option: RouteQueryOption) => {
  const rideLegs = option.legs.filter(
    (leg): leg is RouteQueryRideLeg => leg.type === "ride"
  );

  if (rideLegs.length === 0) {
    return "";
  }

  return rideLegs
    .map((leg) =>
      [
        leg.mode,
        normalizeRouteSignatureText(leg.routeCode),
        normalizeRouteSignatureText(leg.routeName),
        normalizeRouteSignatureText(leg.fromStop.stopName),
        normalizeRouteSignatureText(leg.toStop.stopName)
      ].join(":")
    )
    .join("|");
};

const mergeUniqueFallbackOptions = (input: {
  primaryOptions: RouteQueryOption[];
  fallbackOptions: RouteQueryOption[];
  maxOptions: number;
}) => {
  const mergedOptions = [...input.primaryOptions];
  const knownSignatures = new Set(
    input.primaryOptions.map((option) => buildRideSequenceSignature(option)).filter(Boolean)
  );
  const appendedFallbackOptions: RouteQueryOption[] = [];

  for (const option of input.fallbackOptions) {
    if (mergedOptions.length >= input.maxOptions) {
      break;
    }

    const signature = buildRideSequenceSignature(option);

    if (signature.length > 0 && knownSignatures.has(signature)) {
      continue;
    }

    if (signature.length > 0) {
      knownSignatures.add(signature);
    }

    mergedOptions.push(option);
    appendedFallbackOptions.push(option);
  }

  return {
    mergedOptions,
    appendedFallbackOptions
  };
};

const queryGoogleFallbackSafely = async (input: {
  normalizedQuery: RouteQueryNormalizedInput;
  modifiers: RouteModifier[];
  commuteModes: CommuteMode[];
  passengerType: PassengerType;
}) => {
  const result = await queryGoogleFallbackRoutes(input).catch((error: unknown) => {
    console.warn("Google fallback route lookup failed", {
      operation: "google_fallback_route_lookup",
      reason: error instanceof Error ? error.message : "unknown error"
    });

    return {
      status: "unavailable",
      options: [],
      message: "Google Maps fallback is unavailable right now."
    } satisfies RouteQueryResult["googleFallback"];
  });

  if (result.options.length <= MAX_ROUTE_OPTIONS) {
    return result;
  }

  return {
    ...result,
    options: result.options.slice(0, MAX_ROUTE_OPTIONS)
  };
};

const finalizeRouteOptions = async (input: {
  normalizedQuery: RouteQueryNormalizedInput;
  primaryOptions: RouteQueryOption[];
  fallbackQuery: {
    modifiers: RouteModifier[];
    commuteModes: CommuteMode[];
    passengerType: PassengerType;
  };
}) => {
  const cappedPrimaryOptions = input.primaryOptions.slice(0, MAX_ROUTE_OPTIONS);

  if (cappedPrimaryOptions.length >= MAX_ROUTE_OPTIONS) {
    return {
      options: cappedPrimaryOptions,
      googleFallback: createSkippedGoogleFallback()
    };
  }

  const googleFallback = await queryGoogleFallbackSafely({
    normalizedQuery: input.normalizedQuery,
    modifiers: input.fallbackQuery.modifiers,
    commuteModes: input.fallbackQuery.commuteModes,
    passengerType: input.fallbackQuery.passengerType
  });

  if (googleFallback.options.length === 0) {
    return {
      options: cappedPrimaryOptions,
      googleFallback
    };
  }

  const { mergedOptions, appendedFallbackOptions } = mergeUniqueFallbackOptions({
    primaryOptions: cappedPrimaryOptions,
    fallbackOptions: googleFallback.options,
    maxOptions: MAX_ROUTE_OPTIONS
  });

  return {
    options: mergedOptions,
    googleFallback: {
      ...googleFallback,
      options: appendedFallbackOptions
    }
  };
};

const dedupeCandidateDrafts = (
  drafts: CandidateDraft[],
  input: {
    preference: RoutePreference;
    modifiers: RouteModifier[];
    commuteModes: CommuteMode[];
  }
) => {
  const draftMap = new Map<string, { draft: CandidateDraft; metrics: ReturnType<typeof buildPlannerCandidateMetrics> }>();

  for (const draft of drafts) {
    const transferDurationsMinutes = draft.transitionLegs
      .filter((transitionLeg) => transitionLeg.id.startsWith("transfer:"))
      .map((transitionLeg) => transitionLeg.durationMinutes);
    const rideSegments = draft.rideLegs.map((rideLeg, rideIndex) => ({
      mode: rideLeg.variant.route.primaryMode,
      durationMinutes: rideLeg.durationMinutes,
      distanceMeters: rideLeg.distanceKm * 1_000,
      transferBefore: rideIndex > 0 && draft.transitionLegs.some((transitionLeg) => transitionLeg.id === `transfer:${rideIndex - 1}`),
      transferAfter: draft.transitionLegs.some((transitionLeg) => transitionLeg.id === `transfer:${rideIndex}`)
    }));
    const metrics = buildPlannerCandidateMetrics({
      preference: input.preference,
      modifiers: input.modifiers,
      commuteModes: input.commuteModes,
      totalDurationMinutes:
        draft.rideLegs.reduce((total, rideLeg) => total + rideLeg.durationMinutes, 0) +
        draft.transitionLegs.reduce((total, transitionLeg) => total + transitionLeg.durationMinutes, 0),
      rideSegments,
      transferDurationsMinutes
    });
    const existing = draftMap.get(draft.signature);

    if (!existing || metrics.score < existing.metrics.score) {
      draftMap.set(draft.signature, {
        draft,
        metrics
      });
    }
  }

  const prioritized = [...draftMap.values()].sort(
    (left, right) =>
      left.metrics.score - right.metrics.score ||
      left.metrics.transferCount - right.metrics.transferCount ||
      left.metrics.rideHopCount - right.metrics.rideHopCount ||
      left.metrics.totalDurationMinutes - right.metrics.totalDurationMinutes ||
      left.draft.signature.localeCompare(right.draft.signature)
  );
  const filtered: typeof prioritized = [];

  for (const candidate of prioritized) {
    if (filtered.some((existing) => dominatesPlannerCandidate(existing.metrics, candidate.metrics))) {
      continue;
    }

    for (let index = filtered.length - 1; index >= 0; index -= 1) {
      const existing = filtered[index];

      if (existing && dominatesPlannerCandidate(candidate.metrics, existing.metrics)) {
        filtered.splice(index, 1);
      }
    }

    filtered.push(candidate);
  }

  return filtered.map((entry) => entry.draft);
};

const mapWithConcurrency = async <TValue, TResult>(
  items: TValue[],
  concurrencyLimit: number,
  mapper: (item: TValue, index: number) => Promise<TResult>
) => {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      const item = items[currentIndex];

      nextIndex += 1;

      if (item === undefined) {
        continue;
      }

      results[currentIndex] = await mapper(item, currentIndex);
    }
  };

  await Promise.all(
    Array.from(
      {
        length: Math.min(concurrencyLimit, items.length)
      },
      () => worker()
    )
  );

  return results;
};

export const queryRoutes = async (input: {
  request: RouteQueryRequest;
  userId?: string;
  accessToken?: string;
}): Promise<RouteQueryResult> => {
  const parsedContext = await parseQueryText(input.request);

  if (!parsedContext.origin || !parsedContext.destination) {
    throw buildClarificationError({
      field: getClarificationField(parsedContext)
    });
  }

  const [effectiveValues, originResolution, destinationResolution] = await Promise.all([
    getEffectivePreferenceValues({
      userId: input.userId,
      accessToken: input.accessToken,
      preference: input.request.preference,
      passengerType: input.request.passengerType,
      modifiers: input.request.modifiers,
      commuteModes: input.request.commuteModes,
      allowCarAccess: input.request.allowCarAccess,
      parsedPreference: parsedContext.intent?.preference,
      parsedPassengerType: parsedContext.intent?.passengerType,
      parsedModifiers: parsedContext.intent?.modifiers,
      parsedCommuteModes: parsedContext.intent?.commuteModes,
      parsedAllowCarAccess: parsedContext.intent?.allowCarAccess
    }),
    resolveEndpoint("origin", parsedContext.origin, {
      queryText: input.request.queryText
    }),
    resolveEndpoint("destination", parsedContext.destination, {
      queryText: input.request.queryText
    })
  ]);
  const fallbackNormalizedQuery: RouteQueryNormalizedInput = {
    origin: {
      placeId: originResolution.place.id,
      label: originResolution.place.canonicalName,
      matchedBy: originResolution.place.matchedBy,
      latitude: originResolution.place.latitude,
      longitude: originResolution.place.longitude
    },
    destination: {
      placeId: destinationResolution.place.id,
      label: destinationResolution.place.canonicalName,
      matchedBy: destinationResolution.place.matchedBy,
      latitude: destinationResolution.place.latitude,
      longitude: destinationResolution.place.longitude
    },
    preference: effectiveValues.preference.value,
    passengerType: effectiveValues.passengerType.value,
    preferenceSource: effectiveValues.preference.source,
    passengerTypeSource: effectiveValues.passengerType.source,
    modifiers: effectiveValues.modifiers.value,
    modifierSource: effectiveValues.modifiers.source,
    commuteModes: effectiveValues.commuteModes.value,
    commuteModeSource: effectiveValues.commuteModes.source,
    allowCarAccess: effectiveValues.allowCarAccess.value,
    carAccessSource: effectiveValues.allowCarAccess.source
  };

  const transitAttempt = await queryTransitRoutesIfPossible({
    origin: buildPointFromResolvedPlace(parsedContext.origin, originResolution.place),
    destination: buildPointFromResolvedPlace(parsedContext.destination, destinationResolution.place),
    preference: effectiveValues.preference,
    passengerType: effectiveValues.passengerType,
    modifiers: effectiveValues.modifiers,
    commuteModes: effectiveValues.commuteModes,
    allowCarAccess: effectiveValues.allowCarAccess
  });

  if (transitAttempt.status === "success" && transitAttempt.result) {
    const finalizedTransitOptions = await finalizeRouteOptions({
      normalizedQuery: transitAttempt.result.normalizedQuery,
      primaryOptions: transitAttempt.result.options,
      fallbackQuery: {
        modifiers: effectiveValues.modifiers.value,
        commuteModes: effectiveValues.commuteModes.value,
        passengerType: effectiveValues.passengerType.value
      }
    });

    return {
      ...transitAttempt.result,
      options: await attachRouteCommunityMetadata(finalizedTransitOptions.options),
      googleFallback: finalizedTransitOptions.googleFallback
    };
  }

  const normalizedQuery = fallbackNormalizedQuery;
  let legacyOptions: RouteQueryOption[] = [];

  const legacyOriginAccessStops = filterAccessStopsForCarPreference(
    originResolution.accessStops,
    effectiveValues.allowCarAccess.value
  );
  const legacyDestinationAccessStops = filterAccessStopsForCarPreference(
    destinationResolution.accessStops,
    effectiveValues.allowCarAccess.value
  );

  if (legacyOriginAccessStops.length > 0 && legacyDestinationAccessStops.length > 0) {
    const variants = await routeModel.listActiveRouteVariants();

    if (variants.length > 0) {
      const originAccessMap = buildStopAccessMap(legacyOriginAccessStops);
      const destinationAccessMap = buildStopAccessMap(legacyDestinationAccessStops);
      const originSlices = listRouteSlicesFromAccessStops(
        variants,
        new Set(originAccessMap.keys())
      );

      const transferPoints = await transferPointModel.listTransferPointsByStopIds(
        variants.flatMap((variant) => variant.legs.flatMap((leg) => [leg.fromStop.id, leg.toStop.id]))
      );
      const candidateDrafts = buildMultimodalCandidateDrafts({
        variants,
        originSlices,
        originAccessMap,
        destinationAccessMap,
        transferPoints,
        originLabel: normalizedQuery.origin.label,
        destinationLabel: normalizedQuery.destination.label,
        preference: normalizedQuery.preference,
        modifiers: normalizedQuery.modifiers,
        commuteModes: normalizedQuery.commuteModes
      });

      if (candidateDrafts.length > 0) {
        const fareCatalog = await fareModel.getActiveFareCatalog([
          ...new Set(
            candidateDrafts.flatMap((draft) => [
              ...draft.rideLegs.map((rideLeg) => rideLeg.variant.route.primaryMode),
              ...draft.transitionLegs.flatMap((transitionLeg) =>
                transitionLeg.mode === "drive" ? ["car" as const] : []
              )
            ])
          )
        ]);
        const routeOptions = candidateDrafts.flatMap((draft) => {
          try {
            return [
              buildRouteOption(
                draft,
                fareCatalog,
                normalizedQuery.passengerType,
                "Alternative option",
                normalizedQuery
              )
            ];
          } catch (error) {
            if (error instanceof HttpError) {
              console.warn("Dropped route draft during option building", {
                operation: "route_query_option_drop",
                reason: error.message,
                includesDrive: draft.transitionLegs.some((transitionLeg) => transitionLeg.mode === "drive")
              });
              return [];
            }

            throw error;
          }
        });

        if (routeOptions.length > 0) {
          const rankedOptions = rankRouteOptions(
            routeOptions,
            normalizedQuery.preference,
            normalizedQuery.modifiers,
            normalizedQuery.commuteModes,
            normalizedQuery.allowCarAccess
          );
          const optionsWithIncidents = await attachRelevantIncidentsToOptions({
            options: rankedOptions.slice(0, MAX_ROUTE_OPTIONS),
            normalizedQuery
          });
          legacyOptions = await mapWithConcurrency(
            optionsWithIncidents,
            ROUTE_SUMMARY_CONCURRENCY,
            async (option) => ({
              ...option,
              summary: await generateRouteSummary({
                option,
                normalizedQuery
              })
            })
          );
        }
      }
    }
  }

  if (legacyOptions.length > 0) {
    const finalizedLegacyOptions = await finalizeRouteOptions({
      normalizedQuery,
      primaryOptions: legacyOptions,
      fallbackQuery: {
        modifiers: effectiveValues.modifiers.value,
        commuteModes: effectiveValues.commuteModes.value,
        passengerType: effectiveValues.passengerType.value
      }
    });

    return {
      normalizedQuery,
      options: await attachRouteCommunityMetadata(finalizedLegacyOptions.options),
      googleFallback: finalizedLegacyOptions.googleFallback
    };
  }

  const googleFallback = await queryGoogleFallbackSafely({
    normalizedQuery,
    modifiers: effectiveValues.modifiers.value,
    commuteModes: effectiveValues.commuteModes.value,
    passengerType: effectiveValues.passengerType.value
  });

  if (googleFallback.options.length > 0) {
    return {
      normalizedQuery,
      options: await attachRouteCommunityMetadata(googleFallback.options),
      googleFallback: {
        ...googleFallback,
        options: await attachRouteCommunityMetadata(googleFallback.options)
      }
    };
  }

  return {
    normalizedQuery,
    options: [],
    googleFallback,
    message: buildRouteQueryMessage(normalizedQuery)
  };
};
