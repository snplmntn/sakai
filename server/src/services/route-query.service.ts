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
    ? await userPreferenceModel.getUserPreferenceByUserId(input.userId)
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

const resolveEndpoint = async (
  field: "origin" | "destination",
  point: RouteQueryPointInput,
  options?: {
    queryText?: string;
  }
): Promise<EndpointResolution> => {
  const resolution = await placeModel.resolvePlaceReference({
    placeId: point.placeId,
    query: point.label
  });

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

  const coordinates = getCoordinatesFromPoint(point);

  if (coordinates) {
    const nearbyStops = await stopModel.findNearestStops({
      coordinates,
      limit: 20,
      modes: RIDE_STOP_MODES
    });

    for (const nearbyStop of nearbyStops) {
      if (nearbyStop.distanceMeters > MAX_ACCESS_DISTANCE_METERS) {
        continue;
      }

      const candidate = buildAccessStopCandidate(nearbyStop, nearbyStop.distanceMeters);
      const existingCandidate = accessStopMap.get(nearbyStop.id);

      if (!existingCandidate || candidate.distanceMeters < existingCandidate.distanceMeters) {
        accessStopMap.set(nearbyStop.id, candidate);
      }
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

const listRouteSlicesFromAccessStops = (
  variants: RouteVariant[],
  accessStopIds: Set<string>
): RouteSlice[] =>
  variants.flatMap((variant) =>
    variant.legs.flatMap((leg, startIndex) => {
      if (!accessStopIds.has(leg.fromStop.id)) {
        return [];
      }

      return variant.legs.slice(startIndex).map((_ignored, offset) =>
        buildRouteSlice(variant, startIndex, startIndex + offset)
      );
    })
  );

const buildTransferMapByFromStopId = (transferPoints: TransferPoint[]) => {
  const transferMap = new Map<string, TransferPoint[]>();

  for (const transferPoint of transferPoints) {
    const existingTransfers = transferMap.get(transferPoint.fromStopId) ?? [];

    existingTransfers.push(transferPoint);
    transferMap.set(transferPoint.fromStopId, existingTransfers);
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
  const destinationSlices = listRouteSlicesFromAccessStops(
    variants,
    new Set(
      variants.flatMap((variant) =>
        variant.legs
          .filter((leg) => destinationAccessMap.has(leg.toStop.id))
          .map((leg) => leg.fromStop.id)
      )
    )
  ).filter((slice) => destinationAccessMap.has(slice.toStop.id));

  const directDrafts = originSlices
    .filter((slice) => destinationAccessMap.has(slice.toStop.id))
    .map((slice) => {
      const originAccess = originAccessMap.get(slice.fromStop.id);
      const destinationAccess = destinationAccessMap.get(slice.toStop.id);

      if (!originAccess || !destinationAccess) {
        return null;
      }

      const walkLegs: CandidateDraft["walkLegs"] = [];

      if (originAccess.distanceMeters > 0) {
        walkLegs.push({
          id: `access:${slice.fromStop.id}`,
          fromLabel: normalizedQuery.origin.label,
          toLabel: slice.fromStop.stopName,
          distanceMeters: originAccess.distanceMeters,
          durationMinutes: originAccess.durationMinutes
        });
      }

      if (destinationAccess.distanceMeters > 0) {
        walkLegs.push({
          id: `egress:${slice.toStop.id}`,
          fromLabel: slice.toStop.stopName,
          toLabel: normalizedQuery.destination.label,
          distanceMeters: destinationAccess.distanceMeters,
          durationMinutes: destinationAccess.durationMinutes
        });
      }

      return {
        signature: buildCandidateSignature([
          `${slice.variant.id}:${slice.fromStop.id}:${slice.toStop.id}`
        ]),
        rideLegs: [slice],
        walkLegs
      } satisfies CandidateDraft;
    })
    .filter((draft): draft is CandidateDraft => Boolean(draft));

  const transferPoints = await transferPointModel.listTransferPointsByStopIds(
    variants.flatMap((variant) => variant.legs.flatMap((leg) => [leg.fromStop.id, leg.toStop.id]))
  );
  const transferMap = buildTransferMapByFromStopId(transferPoints);
  const destinationSlicesByBoardingStopId = new Map<string, RouteSlice[]>();

  for (const destinationSlice of destinationSlices) {
    const existingSlices = destinationSlicesByBoardingStopId.get(destinationSlice.fromStop.id) ?? [];

    existingSlices.push(destinationSlice);
    destinationSlicesByBoardingStopId.set(destinationSlice.fromStop.id, existingSlices);
  }

  const transferDrafts = originSlices.flatMap((firstSlice) => {
    const originAccess = originAccessMap.get(firstSlice.fromStop.id);

    if (!originAccess) {
      return [];
    }

    return (transferMap.get(firstSlice.toStop.id) ?? []).flatMap((transferPoint) => {
      const secondSlices = destinationSlicesByBoardingStopId.get(transferPoint.toStopId) ?? [];

      return secondSlices
        .filter((secondSlice) => secondSlice.variant.id !== firstSlice.variant.id)
        .map((secondSlice) => {
          const destinationAccess = destinationAccessMap.get(secondSlice.toStop.id);

          if (!destinationAccess) {
            return null;
          }

          const walkLegs: CandidateDraft["walkLegs"] = [];

          if (originAccess.distanceMeters > 0) {
            walkLegs.push({
              id: `access:${firstSlice.fromStop.id}`,
              fromLabel: normalizedQuery.origin.label,
              toLabel: firstSlice.fromStop.stopName,
              distanceMeters: originAccess.distanceMeters,
              durationMinutes: originAccess.durationMinutes
            });
          }

          walkLegs.push({
            id: "transfer:0",
            fromLabel: firstSlice.toStop.stopName,
            toLabel: secondSlice.fromStop.stopName,
            distanceMeters: transferPoint.walkingDistanceM,
            durationMinutes: transferPoint.walkingDurationMinutes
          });

          if (destinationAccess.distanceMeters > 0) {
            walkLegs.push({
              id: `egress:${secondSlice.toStop.id}`,
              fromLabel: secondSlice.toStop.stopName,
              toLabel: normalizedQuery.destination.label,
              distanceMeters: destinationAccess.distanceMeters,
              durationMinutes: destinationAccess.durationMinutes
            });
          }

          return {
            signature: buildCandidateSignature([
              `${firstSlice.variant.id}:${firstSlice.fromStop.id}:${firstSlice.toStop.id}`,
              `${transferPoint.fromStopId}:${transferPoint.toStopId}`,
              `${secondSlice.variant.id}:${secondSlice.fromStop.id}:${secondSlice.toStop.id}`
            ]),
            rideLegs: [firstSlice, secondSlice],
            walkLegs
          } satisfies CandidateDraft;
        })
        .filter((draft): draft is CandidateDraft => Boolean(draft));
    });
  });

  const candidateDrafts = dedupeCandidateDrafts([...directDrafts, ...transferDrafts]);

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
  const summarizedOptions = await mapWithConcurrency(
    rankedOptions,
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
