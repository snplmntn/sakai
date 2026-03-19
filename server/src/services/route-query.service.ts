import { createHash } from "node:crypto";

import {
  AiInvalidResponseError,
  AiUnavailableError
} from "../ai/client.js";
import { parseRouteIntent } from "../ai/intent-parser.js";
import { generateRouteSummary } from "../ai/route-summary.js";
import type { RouteIntent } from "../ai/types.js";
import * as areaUpdateModel from "../models/area-update.model.js";
import * as fareModel from "../models/fare.model.js";
import * as placeModel from "../models/place.model.js";
import * as routeModel from "../models/route.model.js";
import * as stopModel from "../models/stop.model.js";
import * as transferPointModel from "../models/transfer-point.model.js";
import * as userPreferenceModel from "../models/user-preference.model.js";
import { HttpError } from "../types/http-error.js";
import type { FareBreakdown, PassengerType } from "../types/fare.js";
import type { PlaceMatch, RouteLeg, RouteVariant, Stop, StopMode, TransferPoint } from "../types/route-network.js";
import type {
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
import { rankRouteOptions } from "./route-ranking.service.js";

const DEFAULT_ROUTE_PREFERENCE: RoutePreference = "balanced";
const DEFAULT_PASSENGER_TYPE: PassengerType = "regular";
const MAX_ACCESS_DISTANCE_METERS = 500;
const ROUTE_SUMMARY_CONCURRENCY = 3;
const WALKING_METERS_PER_MINUTE = 80;
const RIDE_STOP_MODES: StopMode[] = ["jeepney", "uv", "mrt3", "lrt1", "lrt2"];
const MAX_RELEVANT_INCIDENTS = 3;
const MAX_RIDE_LEGS_PER_OPTION = 4;

interface RouteQueryRequest {
  origin?: RouteQueryPointInput;
  destination?: RouteQueryPointInput;
  queryText?: string;
  preference?: RoutePreference;
  passengerType?: PassengerType;
}

interface EffectiveValue<T> {
  value: T;
  source: RouteQueryValueSource;
}

interface AccessStopCandidate {
  stop: Stop;
  distanceMeters: number;
  durationMinutes: number;
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
  walkLegs: Array<{
    id: string;
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
  walkLegs: CandidateDraft["walkLegs"];
  visitedStopIds: Set<string>;
}

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
      origin: request.origin,
      destination: request.destination
    };
  }

  try {
    const intent = await parseRouteIntent(request.queryText);

    if (intent.requiresClarification) {
      throw buildClarificationError({
        field: intent.clarificationField ?? "both"
      });
    }

    return {
      intent,
      origin: request.origin ?? (intent.originText ? { label: intent.originText } : undefined),
      destination:
        request.destination ??
        (intent.destinationText ? { label: intent.destinationText } : undefined)
    };
  } catch (error) {
    if (!isRecoverableIntentError(error)) {
      throw error;
    }

    console.warn("Unable to parse route query text with AI", {
      operation: "intent_parser",
      reason: error.message
    });

    if (request.origin && request.destination) {
      return {
        intent: null,
        origin: request.origin,
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
  parsedPreference?: RoutePreference | null;
  parsedPassengerType?: PassengerType | null;
}): Promise<{
  preference: EffectiveValue<RoutePreference>;
  passengerType: EffectiveValue<PassengerType>;
}> => {
  if (input.preference && input.passengerType) {
    return {
      preference: {
        value: input.preference,
        source: "request_override"
      },
      passengerType: {
        value: input.passengerType,
        source: "request_override"
      }
    };
  }

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
            }
  };
};

const getCoordinatesFromPoint = (point: RouteQueryPointInput) =>
  typeof point.latitude === "number" && typeof point.longitude === "number"
    ? {
        latitude: point.latitude,
        longitude: point.longitude
      }
    : null;

const buildAccessStopCandidate = (stop: Stop, distanceMeters: number): AccessStopCandidate => ({
  stop,
  distanceMeters,
  durationMinutes: roundMinutes(distanceMeters / WALKING_METERS_PER_MINUTE)
});

const listNearbyRideAccessStops = async (point: RouteQueryPointInput) => {
  const coordinates = getCoordinatesFromPoint(point);

  if (!coordinates) {
    return [];
  }

  const nearbyStops = await stopModel.findNearestStops({
    coordinates,
    limit: 20,
    modes: RIDE_STOP_MODES
  });

  return nearbyStops.filter((nearbyStop) => nearbyStop.distanceMeters <= MAX_ACCESS_DISTANCE_METERS);
};

const resolvePlaceFromNearbyStops = async (input: {
  point: RouteQueryPointInput;
  nearbyStops: Awaited<ReturnType<typeof listNearbyRideAccessStops>>;
}) => {
  const nearestStopWithPlace = input.nearbyStops.find((nearbyStop) => Boolean(nearbyStop.placeId));

  if (!nearestStopWithPlace?.placeId) {
    return null;
  }

  const place = await placeModel.getPlaceById(nearestStopWithPlace.placeId);

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
        : nearestStopWithPlace.stopName)
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
  const nearbyStops = await listNearbyRideAccessStops(point);

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

  for (const stop of await stopModel.listStopsByPlaceId(resolution.place.id)) {
    accessStopMap.set(stop.id, buildAccessStopCandidate(stop, 0));
  }

  for (const nearbyStop of nearbyStops) {
    const candidate = buildAccessStopCandidate(nearbyStop, nearbyStop.distanceMeters);
    const existingCandidate = accessStopMap.get(nearbyStop.id);

    if (!existingCandidate || candidate.distanceMeters < existingCandidate.distanceMeters) {
      accessStopMap.set(nearbyStop.id, candidate);
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
}) =>
  buildCandidateSignature([
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
    walkLegs: CandidateDraft["walkLegs"];
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

  const walkLegs: CandidateDraft["walkLegs"] = [...input.walkLegs];

  if (destinationAccess.distanceMeters > 0) {
    walkLegs.push({
      id: `egress:${lastStopId}`,
      fromLabel: input.rideLegs.at(-1)?.toStop.stopName ?? lastStopId,
      toLabel: input.destinationLabel,
      distanceMeters: destinationAccess.distanceMeters,
      durationMinutes: destinationAccess.durationMinutes
    });
  }

  return {
    signature: buildCandidateSignatureFromRidePath({
      rideLegs: input.rideLegs,
      transferLabels: input.transferLabels
    }),
    rideLegs: input.rideLegs,
    walkLegs
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
}): CandidateDraft[] => {
  const routeSlicesByFromStopId = listRouteSlicesFromStopIds(input.variants);
  const transferMap = buildTransferMapByFromStopId(input.transferPoints);
  const queue: MultimodalPathState[] = [];
  const destinationCandidates: CandidateDraft[] = [];
  const stopNameById = new Map<string, string>();

  for (const variant of input.variants) {
    for (const leg of variant.legs) {
      stopNameById.set(leg.fromStop.id, leg.fromStop.stopName);
      stopNameById.set(leg.toStop.id, leg.toStop.stopName);
    }
  }

  for (const stopId of input.originAccessMap.keys()) {
    const accessCandidate = input.originAccessMap.get(stopId);

    if (accessCandidate) {
      stopNameById.set(accessCandidate.stop.id, accessCandidate.stop.stopName);
    }
  }

  for (const stopId of input.destinationAccessMap.keys()) {
    const accessCandidate = input.destinationAccessMap.get(stopId);

    if (accessCandidate) {
      stopNameById.set(accessCandidate.stop.id, accessCandidate.stop.stopName);
    }
  }

  const pushOriginState = (firstSlice: RouteSlice) => {
    const originAccess = input.originAccessMap.get(firstSlice.fromStop.id);

    if (!originAccess) {
      return;
    }

    const walkLegs: CandidateDraft["walkLegs"] = [];

    if (originAccess.distanceMeters > 0) {
      walkLegs.push({
        id: `access:${firstSlice.fromStop.id}`,
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
      walkLegs,
      visitedStopIds: new Set([firstSlice.fromStop.id, firstSlice.toStop.id])
    };

    const destinationDraft = buildCandidateDraftForDestination(
      {
        rideLegs: state.rideLegs,
        walkLegs: state.walkLegs,
        transferLabels: state.transferLabels,
        destinationLabel: input.destinationLabel,
      },
      input.destinationAccessMap
    );
    if (destinationDraft) {
      destinationCandidates.push(destinationDraft);
    }

    queue.push(state);
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
      if (currentState.visitedStopIds.has(transferPoint.toStopId)) {
        continue;
      }

      const nextWalkLegs: CandidateDraft["walkLegs"] = [
        ...currentState.walkLegs,
        {
          id: `transfer:${transferWalkIndex}`,
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

      const destinationDraft = buildCandidateDraftForDestination(
        {
          rideLegs: currentState.rideLegs,
          walkLegs: nextWalkLegs,
          transferLabels: nextTransferLabels,
          destinationLabel: input.destinationLabel
        },
        input.destinationAccessMap
      );

      if (destinationDraft) {
        destinationCandidates.push(destinationDraft);
      }

      const nextSlices = routeSlicesByFromStopId.get(transferPoint.toStopId) ?? [];

      for (const nextSlice of nextSlices) {
        if (currentState.visitedStopIds.has(nextSlice.toStop.id)) {
          continue;
        }

        const nextVisitedStopIds = new Set(currentState.visitedStopIds);
        nextVisitedStopIds.add(nextSlice.toStop.id);

        queue.push({
          currentStopId: nextSlice.toStop.id,
          rideLegs: [...currentState.rideLegs, nextSlice],
          transferLabels: nextTransferLabels,
          walkLegs: nextWalkLegs,
          visitedStopIds: nextVisitedStopIds
        });
      }
    }
  }

  return dedupeCandidateDrafts(destinationCandidates);
};

const buildTransferMapByFromStopId = (transferPoints: TransferPoint[]) => {
  const transferMap = new Map<string, TransferPoint[]>();

  for (const transferPoint of transferPoints) {
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

const buildRouteQueryRideLeg = (
  rideLeg: RouteSlice,
  fare: FareBreakdown
): RouteQueryRideLeg => ({
  type: "ride",
  id: `${rideLeg.variant.id}:${rideLeg.fromStop.id}:${rideLeg.toStop.id}`,
  mode: rideLeg.variant.route.primaryMode,
  routeId: rideLeg.variant.route.id,
  routeVariantId: rideLeg.variant.id,
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
  initialRecommendationLabel: string
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
  const legs: RouteQueryLeg[] = [];

  for (const walkLeg of draft.walkLegs) {
    if (walkLeg.id.startsWith("access:")) {
      legs.push(buildWalkLeg(walkLeg));
    }
  }

  for (let rideIndex = 0; rideIndex < draft.rideLegs.length; rideIndex += 1) {
    const rideLeg = draft.rideLegs[rideIndex];
    const fare = fareByRideLegId.get(`${rideLeg.variant.id}:${rideLeg.fromStop.id}:${rideLeg.toStop.id}`);

    if (!fare) {
      throw new HttpError(500, `Missing fare for route leg ${rideLeg.variant.id}`);
    }

    legs.push(buildRouteQueryRideLeg(rideLeg, fare));

    const transferWalkLeg = draft.walkLegs.find((walkLeg) => walkLeg.id === `transfer:${rideIndex}`);

    if (transferWalkLeg) {
      legs.push(buildWalkLeg(transferWalkLeg));
    }
  }

  for (const walkLeg of draft.walkLegs) {
    if (walkLeg.id.startsWith("egress:")) {
      legs.push(buildWalkLeg(walkLeg));
    }
  }

  return {
    id: buildRouteOptionId(draft.signature),
    summary: "",
    recommendationLabel: initialRecommendationLabel,
    highlights: [],
    totalDurationMinutes: legs.reduce((total, leg) => total + leg.durationMinutes, 0),
    totalFare: pricedRideLegs.totalFare,
    fareConfidence: pricedRideLegs.fareConfidence,
    transferCount: Math.max(0, draft.rideLegs.length - 1),
    corridorTags: [...new Set(draft.rideLegs.flatMap((rideLeg) => rideLeg.corridorTags))],
    fareAssumptions: pricedRideLegs.fareAssumptions,
    legs,
    relevantIncidents: []
  };
};

const buildRouteQueryMessage = (normalizedQuery: RouteQueryNormalizedInput) =>
  `No supported route found for ${normalizedQuery.origin.label} to ${normalizedQuery.destination.label} in the current coverage`;

const getIncidentSeverityWeight = (severity: "low" | "medium" | "high") =>
  severity === "high" ? 3 : severity === "medium" ? 2 : 1;

const sortRelevantIncidents = (
  incidents: areaUpdateModel.AreaUpdate[]
) =>
  [...incidents].sort(
    (left, right) =>
      getIncidentSeverityWeight(right.severity) - getIncidentSeverityWeight(left.severity) ||
      right.scrapedAt.localeCompare(left.scrapedAt) ||
      left.id.localeCompare(right.id)
  );

const attachRelevantIncidents = async (input: {
  options: RouteQueryOption[];
  normalizedQuery: RouteQueryNormalizedInput;
}) => {
  if (input.options.length === 0) {
    return input.options;
  }

  let activeIncidents: areaUpdateModel.AreaUpdate[];

  try {
    activeIncidents = await areaUpdateModel.listActiveAreaUpdates(100);
  } catch (error) {
    console.warn("Unable to load active area updates for route query", {
      operation: "route_query_incidents",
      reason: error instanceof Error ? error.message : "unknown error"
    });
    return input.options;
  }

  if (activeIncidents.length === 0) {
    return input.options;
  }

  const originLabel = placeModel.normalizePlaceSearchText(input.normalizedQuery.origin.label);
  const destinationLabel = placeModel.normalizePlaceSearchText(
    input.normalizedQuery.destination.label
  );

  return input.options.map((option) => {
    const corridorTags = new Set(option.corridorTags.map((tag) => tag.toLowerCase()));
    const relevantIncidents = sortRelevantIncidents(
      activeIncidents.filter((incident) => {
        const incidentLocation = placeModel.normalizePlaceSearchText(incident.normalizedLocation);

        return (
          incident.corridorTags.some((tag) => corridorTags.has(tag.toLowerCase())) ||
          incidentLocation.includes(originLabel) ||
          incidentLocation.includes(destinationLabel)
        );
      })
    )
      .slice(0, MAX_RELEVANT_INCIDENTS)
      .map((incident) => ({
        id: incident.id,
        alertType: incident.alertType,
        location: incident.location,
        direction: incident.direction,
        severity: incident.severity,
        summary: incident.summary,
        displayUntil: incident.displayUntil,
        scrapedAt: incident.scrapedAt,
        sourceUrl: incident.sourceUrl
      }));

    return {
      ...option,
      relevantIncidents
    };
  });
};

const dedupeCandidateDrafts = (drafts: CandidateDraft[]) => {
  const draftMap = new Map<string, CandidateDraft>();

  for (const draft of drafts) {
    if (!draftMap.has(draft.signature)) {
      draftMap.set(draft.signature, draft);
    }
  }

  return [...draftMap.values()];
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
      parsedPreference: parsedContext.intent?.preference,
      parsedPassengerType: parsedContext.intent?.passengerType
    }),
    resolveEndpoint("origin", parsedContext.origin, {
      queryText: input.request.queryText
    }),
    resolveEndpoint("destination", parsedContext.destination, {
      queryText: input.request.queryText
    })
  ]);
  const normalizedQuery: RouteQueryNormalizedInput = {
    origin: {
      placeId: originResolution.place.id,
      label: originResolution.place.canonicalName,
      matchedBy: originResolution.place.matchedBy
    },
    destination: {
      placeId: destinationResolution.place.id,
      label: destinationResolution.place.canonicalName,
      matchedBy: destinationResolution.place.matchedBy
    },
    preference: effectiveValues.preference.value,
    passengerType: effectiveValues.passengerType.value,
    preferenceSource: effectiveValues.preference.source,
    passengerTypeSource: effectiveValues.passengerType.source
  };

  if (originResolution.accessStops.length === 0 || destinationResolution.accessStops.length === 0) {
    return {
      normalizedQuery,
      options: [],
      message: buildRouteQueryMessage(normalizedQuery)
    };
  }

  const variants = await routeModel.listActiveRouteVariants();

  if (variants.length === 0) {
    return {
      normalizedQuery,
      options: [],
      message: buildRouteQueryMessage(normalizedQuery)
    };
  }

  const originAccessMap = buildStopAccessMap(originResolution.accessStops);
  const destinationAccessMap = buildStopAccessMap(destinationResolution.accessStops);
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
    destinationLabel: normalizedQuery.destination.label
  });

  if (candidateDrafts.length === 0) {
    return {
      normalizedQuery,
      options: [],
      message: buildRouteQueryMessage(normalizedQuery)
    };
  }

  const fareCatalog = await fareModel.getActiveFareCatalog([
    ...new Set(
      candidateDrafts.flatMap((draft) =>
        draft.rideLegs.map((rideLeg) => rideLeg.variant.route.primaryMode)
      )
    )
  ]);
  const routeOptions = candidateDrafts.flatMap((draft) => {
    try {
      return [
        buildRouteOption(
          draft,
          fareCatalog,
          normalizedQuery.passengerType,
          "Alternative option"
        )
      ];
    } catch (error) {
      if (error instanceof HttpError) {
        return [];
      }

      throw error;
    }
  });

  if (routeOptions.length === 0) {
    return {
      normalizedQuery,
      options: [],
      message: buildRouteQueryMessage(normalizedQuery)
    };
  }

  const rankedOptions = rankRouteOptions(routeOptions, normalizedQuery.preference);
  const optionsWithIncidents = await attachRelevantIncidents({
    options: rankedOptions,
    normalizedQuery
  });
  const summarizedOptions = await mapWithConcurrency(
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

  return {
    normalizedQuery,
    options: summarizedOptions
  };
};
