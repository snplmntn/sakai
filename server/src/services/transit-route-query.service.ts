import * as fareModel from "../models/fare.model.js";
import * as placeModel from "../models/place.model.js";
import * as transitGraphModel from "../models/transit-graph.model.js";
import { generateRouteSummary } from "../ai/route-summary.js";
import { HttpError } from "../types/http-error.js";
import type { PassengerType } from "../types/fare.js";
import type { Stop } from "../types/route-network.js";
import type {
  RouteModifier,
  RouteNavigationTarget,
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
import { attachRelevantIncidentsToOptions } from "./route-incident.service.js";
import { rankRouteOptions } from "./route-ranking.service.js";

interface EffectiveValue<T> {
  value: T;
  source: RouteQueryValueSource;
}

interface TransitAccessStop {
  stop: transitGraphModel.TransitStop;
  distanceMeters: number;
  durationMinutes: number;
  fromLabel: string;
}

interface TransitEndpointResolution {
  normalizedPoint: RouteQueryNormalizedInput["origin"];
  accessStops: TransitAccessStop[];
}

interface TransitPathState {
  currentStopId: string;
  totalWeight: number;
  totalDistanceMeters: number;
  rideBoardings: number;
  rawEdges: transitGraphModel.TransitStopEdge[];
  visitedStopIds: Set<string>;
  lastServiceKey: string | null;
}

interface TransitCandidate {
  accessStop: TransitAccessStop;
  destinationStop: TransitAccessStop;
  rawEdges: transitGraphModel.TransitStopEdge[];
  totalWeight: number;
}

const WALKING_METERS_PER_MINUTE = 80;
const MAX_ACCESS_DISTANCE_METERS = 800;
const MAX_ACCESS_STOPS = 4;
const MAX_TRANSIT_QUEUE_SIZE = 500;
const MAX_TRANSIT_CANDIDATES = 8;
const MAX_TRANSIT_RIDE_BOARDINGS = 4;
const MAX_TRANSIT_EDGES = 18;
const SUPPORTED_TRANSIT_MODES = new Set(["jeep", "jeepney", "uv", "mrt3", "lrt1", "lrt2"]);
const fallbackWarningKeys = new Set<string>();

const roundMinutes = (value: number) => Math.max(1, Math.ceil(value));
const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const warnOnce = (key: string, message: string, details: Record<string, unknown>) => {
  if (fallbackWarningKeys.has(key)) {
    return;
  }

  fallbackWarningKeys.add(key);
  console.warn(message, details);
};

const createWalkFareBreakdown = () => ({
  amount: 0,
  pricingType: "official" as const,
  fareProductCode: null,
  ruleVersionName: null,
  effectivityDate: null,
  isDiscountApplied: false,
  assumptionText: null
});

const mapTransitModeToRideMode = (mode: string, line: string) => {
  const normalizedMode = mode.trim().toLowerCase();
  const normalizedLine = line.trim().toLowerCase();

  if (normalizedMode === "jeep" || normalizedMode === "jeepney") {
    return "jeepney" as const;
  }

  if (normalizedMode === "uv") {
    return "uv" as const;
  }

  if (normalizedMode === "mrt3" || normalizedLine.includes("mrt3")) {
    return "mrt3" as const;
  }

  if (normalizedMode === "lrt1" || normalizedLine.includes("lrt1")) {
    return "lrt1" as const;
  }

  if (normalizedMode === "lrt2" || normalizedLine.includes("lrt2")) {
    return "lrt2" as const;
  }

  return null;
};

const getFareProductCodeForRideMode = (rideMode: RouteQueryRideLeg["mode"]) => {
  if (rideMode === "jeepney") {
    return "puj_traditional";
  }

  if (rideMode === "uv") {
    return "uv_traditional";
  }

  return null;
};

const getServiceKey = (edge: transitGraphModel.TransitStopEdge) =>
  `${edge.mode}:${edge.line}:${edge.routeShortName ?? ""}:${edge.routeLongName ?? ""}`;

const toRouteStop = (
  stop: transitGraphModel.TransitStop,
  clusterId: string | null
): Stop => ({
  id: stop.stopId,
  placeId: clusterId,
  externalStopCode: stop.stopId,
  stopName: stop.stopName,
  mode: mapTransitModeToRideMode(stop.mode, stop.line) ?? "walk_anchor",
  area: stop.stopName.split(",").slice(1).join(",").trim() || "Metro Manila",
  latitude: stop.latitude,
  longitude: stop.longitude,
  isActive: true,
  createdAt: stop.createdAt
});

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
  distanceMeters: Math.round(input.distanceMeters),
  durationMinutes: input.durationMinutes,
  fare: createWalkFareBreakdown()
});

const buildAccessStopsFromCluster = async (clusterId: string, label: string) => {
  const memberStops = await transitGraphModel.listTransitStopsByClusterId(clusterId);

  return memberStops.slice(0, MAX_ACCESS_STOPS).map((stop) => ({
    stop,
    distanceMeters: 0,
    durationMinutes: 0,
    fromLabel: label
  }));
};

const buildAccessStopsFromCoordinates = async (point: RouteQueryPointInput, label: string) => {
  if (typeof point.latitude !== "number" || typeof point.longitude !== "number") {
    return [];
  }

  const nearbyStops = await transitGraphModel.findNearestTransitStops({
    coordinates: {
      latitude: point.latitude,
      longitude: point.longitude
    },
    limit: MAX_ACCESS_STOPS,
    maxDistanceMeters: MAX_ACCESS_DISTANCE_METERS
  });

  return nearbyStops.map((stop) => ({
    stop,
    distanceMeters: stop.distanceMeters,
    durationMinutes: roundMinutes(stop.distanceMeters / WALKING_METERS_PER_MINUTE),
    fromLabel: label
  }));
};

const resolveTransitEndpoint = async (
  field: "origin" | "destination",
  point: RouteQueryPointInput
): Promise<TransitEndpointResolution | null> => {
  const shouldAttemptTransit =
    Boolean(point.placeId?.startsWith("cluster:")) ||
    (typeof point.latitude === "number" && typeof point.longitude === "number");

  if (!shouldAttemptTransit) {
    return null;
  }

  let clusterResolution;

  try {
    clusterResolution = await placeModel.resolvePlaceReference({
      placeId: point.placeId,
      googlePlaceId: point.googlePlaceId,
      query: point.label
    });
  } catch (error) {
    if (transitGraphModel.isTransitGraphUnavailableError(error)) {
      warnOnce("transit_route_query_resolution_fallback", "Transit endpoint resolution unavailable; skipping transit planner", {
        operation: "transit_route_query_resolution_fallback",
        reason: error instanceof Error ? error.message : "unknown error"
      });
      return null;
    }

    throw error;
  }

  if (!clusterResolution) {
    return null;
  }

  if (clusterResolution.status === "ambiguous") {
    throw new HttpError(422, `${field} matches multiple supported places`, {
      field,
      status: "ambiguous",
      matches: clusterResolution.matches
    });
  }

  if (clusterResolution.status === "resolved" && clusterResolution.place.id.startsWith("cluster:")) {
    const accessStops = await buildAccessStopsFromCluster(
      clusterResolution.place.id,
      clusterResolution.place.canonicalName
    ).catch((error) => {
      if (transitGraphModel.isTransitGraphUnavailableError(error)) {
        warnOnce("transit_route_query_cluster_fallback", "Transit cluster access unavailable; skipping transit planner", {
          operation: "transit_route_query_cluster_fallback",
          reason: error instanceof Error ? error.message : "unknown error"
        });
        return [];
      }

      throw error;
    });

    if (accessStops.length === 0) {
      return null;
    }

    return {
      normalizedPoint: {
        placeId: clusterResolution.place.id,
        label: clusterResolution.place.canonicalName,
        matchedBy: clusterResolution.place.matchedBy,
        latitude: clusterResolution.place.latitude,
        longitude: clusterResolution.place.longitude
      },
      accessStops
    };
  }

  const coordinatesLabel = point.label ?? (field === "origin" ? "Current location" : "Destination");
  const coordinateAccessStops = await buildAccessStopsFromCoordinates(point, coordinatesLabel).catch(
    (error) => {
      if (transitGraphModel.isTransitGraphUnavailableError(error)) {
        warnOnce("transit_route_query_nearest_stop_fallback", "Transit nearby-stop access unavailable; skipping transit planner", {
          operation: "transit_route_query_nearest_stop_fallback",
          reason: error instanceof Error ? error.message : "unknown error"
        });
        return [];
      }

      throw error;
    }
  );

  if (coordinateAccessStops.length === 0) {
    return null;
  }

  return {
    normalizedPoint: {
      placeId: clusterResolution.status === "resolved" ? clusterResolution.place.id : `coords:${field}`,
      label:
        clusterResolution.status === "resolved"
          ? clusterResolution.place.canonicalName
          : coordinatesLabel,
      matchedBy:
        clusterResolution.status === "resolved"
          ? clusterResolution.place.matchedBy
          : "coordinates",
      latitude:
        clusterResolution.status === "resolved"
          ? clusterResolution.place.latitude
          : point.latitude ?? coordinateAccessStops[0]?.stop.latitude ?? 0,
      longitude:
        clusterResolution.status === "resolved"
          ? clusterResolution.place.longitude
          : point.longitude ?? coordinateAccessStops[0]?.stop.longitude ?? 0
    },
    accessStops: coordinateAccessStops
  };
};

const buildNavigationTarget = (
  input: {
    normalizedQuery: RouteQueryNormalizedInput;
    rideLegs: RouteQueryRideLeg[];
  }
): RouteNavigationTarget => {
  const lastRideLeg = input.rideLegs.at(-1);

  if (lastRideLeg) {
    return {
      latitude: lastRideLeg.toStop.latitude,
      longitude: lastRideLeg.toStop.longitude,
      label: lastRideLeg.toStop.stopName,
      kind: "dropoff_stop"
    };
  }

  return {
    latitude: input.normalizedQuery.destination.latitude,
    longitude: input.normalizedQuery.destination.longitude,
    label: input.normalizedQuery.destination.label,
    kind: "destination"
  };
};

const buildTransitRouteOption = async (input: {
  candidate: TransitCandidate;
  normalizedQuery: RouteQueryNormalizedInput;
  passengerType: PassengerType;
  initialRecommendationLabel: string;
}): Promise<RouteQueryOption | null> => {
  const stopIds = [
    ...new Set(input.candidate.rawEdges.flatMap((edge) => [edge.sourceStopId, edge.targetStopId]))
  ];
  const stopMap = new Map(
    (
      await transitGraphModel.listTransitStopsByIds(stopIds).catch((error) => {
        if (transitGraphModel.isTransitGraphUnavailableError(error)) {
          warnOnce("transit_route_query_stop_hydration_fallback", "Transit stop hydration unavailable; dropping transit route option", {
            operation: "transit_route_query_stop_hydration_fallback",
            reason: error instanceof Error ? error.message : "unknown error"
          });
          return [];
        }

        throw error;
      })
    ).map((stop) => [stop.stopId, stop])
  );
  const rawLegs: Array<
    | {
        type: "ride";
        serviceKey: string;
        edges: transitGraphModel.TransitStopEdge[];
      }
    | {
        type: "walk";
        edge: transitGraphModel.TransitStopEdge;
      }
  > = [];

  for (const edge of input.candidate.rawEdges) {
    if (edge.transfer) {
      rawLegs.push({
        type: "walk",
        edge
      });
      continue;
    }

    const previousLeg = rawLegs.at(-1);

    if (previousLeg?.type === "ride" && previousLeg.serviceKey === getServiceKey(edge)) {
      previousLeg.edges.push(edge);
      continue;
    }

    rawLegs.push({
      type: "ride",
      serviceKey: getServiceKey(edge),
      edges: [edge]
    });
  }

  const fareRideLegInputs: FareRideLegInput[] = [];
  const rideLegBlueprints: Array<{
    id: string;
    mode: RouteQueryRideLeg["mode"];
    routeCode: string;
    routeName: string;
    directionLabel: string;
    routeLabel: string;
    corridorTags: string[];
    distanceKm: number;
    durationMinutes: number;
    fromStop: Stop;
    toStop: Stop;
    fareProductCode: string | null;
  }> = [];
  const walkLegs: RouteQueryWalkLeg[] = [];

  if (input.candidate.accessStop.distanceMeters > 0) {
    walkLegs.push(
      buildWalkLeg({
        id: `access:${input.candidate.accessStop.stop.stopId}`,
        fromLabel: input.candidate.accessStop.fromLabel,
        toLabel: input.candidate.accessStop.stop.stopName,
        distanceMeters: input.candidate.accessStop.distanceMeters,
        durationMinutes: input.candidate.accessStop.durationMinutes
      })
    );
  }

  for (const rawLeg of rawLegs) {
    if (rawLeg.type === "walk") {
      const fromStop = stopMap.get(rawLeg.edge.sourceStopId);
      const toStop = stopMap.get(rawLeg.edge.targetStopId);

      if (!fromStop || !toStop) {
        return null;
      }

      walkLegs.push(
        buildWalkLeg({
          id: `transfer:${rawLeg.edge.sourceStopId}:${rawLeg.edge.targetStopId}`,
          fromLabel: fromStop.stopName,
          toLabel: toStop.stopName,
          distanceMeters: rawLeg.edge.distanceMeters,
          durationMinutes: roundMinutes(rawLeg.edge.estimatedTimeMinutes)
        })
      );
      continue;
    }

    const firstEdge = rawLeg.edges[0];
    const lastEdge = rawLeg.edges.at(-1);

    if (!firstEdge || !lastEdge) {
      return null;
    }

    const rideMode = mapTransitModeToRideMode(firstEdge.mode, firstEdge.line);

    if (!rideMode || !SUPPORTED_TRANSIT_MODES.has(firstEdge.mode.toLowerCase())) {
      return null;
    }

    const fromTransitStop = stopMap.get(firstEdge.sourceStopId);
    const toTransitStop = stopMap.get(lastEdge.targetStopId);

    if (!fromTransitStop || !toTransitStop) {
      return null;
    }

    const routeCode = firstEdge.line;
    const routeName = firstEdge.routeLongName ?? firstEdge.routeShortName ?? firstEdge.line;
    const legId = `${routeCode}:${fromTransitStop.stopId}:${toTransitStop.stopId}`;
    const fareProductCode = getFareProductCodeForRideMode(rideMode);
    const distanceKm = Number(
      (rawLeg.edges.reduce((total, edge) => total + edge.distanceMeters, 0) / 1000).toFixed(2)
    );
    const durationMinutes = roundMinutes(
      rawLeg.edges.reduce((total, edge) => total + edge.estimatedTimeMinutes, 0)
    );

    fareRideLegInputs.push({
      id: legId,
      mode: rideMode,
      distanceKm,
      fareProductCode,
      fromStopId: fromTransitStop.stopId,
      toStopId: toTransitStop.stopId
    });
    rideLegBlueprints.push({
      id: legId,
      mode: rideMode,
      routeCode,
      routeName,
      directionLabel: routeName,
      routeLabel: routeName,
      corridorTags: [placeModel.normalizePlaceSearchText(firstEdge.line)],
      distanceKm,
      durationMinutes,
      fromStop: toRouteStop(fromTransitStop, input.normalizedQuery.origin.placeId),
      toStop: toRouteStop(toTransitStop, input.normalizedQuery.destination.placeId),
      fareProductCode
    });
  }

  if (rideLegBlueprints.length === 0) {
    return null;
  }

  const fareCatalog = await fareModel.getActiveFareCatalog([
    ...new Set(fareRideLegInputs.map((rideLeg) => rideLeg.mode))
  ]);
  const pricedRideLegs = priceRideLegsWithCatalog(
    fareCatalog,
    fareRideLegInputs,
    input.passengerType
  );
  const fareById = new Map(pricedRideLegs.rideLegs.map((rideLeg) => [rideLeg.id, rideLeg.fare]));
  const routeLegs: RouteQueryLeg[] = [];

  if (walkLegs[0]) {
    routeLegs.push(walkLegs[0]);
  }

  for (let index = 0; index < rideLegBlueprints.length; index += 1) {
    const rideLeg = rideLegBlueprints[index];
    const fare = fareById.get(rideLeg.id);

    if (!fare) {
      return null;
    }

    routeLegs.push({
      type: "ride",
      id: rideLeg.id,
      mode: rideLeg.mode,
      routeId: rideLeg.routeCode,
      routeVariantId: rideLeg.routeCode,
      routeCode: rideLeg.routeCode,
      routeName: rideLeg.routeName,
      directionLabel: rideLeg.directionLabel,
      fromStop: rideLeg.fromStop,
      toStop: rideLeg.toStop,
      routeLabel: rideLeg.routeLabel,
      distanceKm: rideLeg.distanceKm,
      durationMinutes: rideLeg.durationMinutes,
      corridorTags: rideLeg.corridorTags,
      fare
    });

    const transferWalk = walkLegs[index + 1];

    if (transferWalk) {
      routeLegs.push(transferWalk);
    }
  }

  const totalFare = roundCurrency(pricedRideLegs.totalFare);
  const rideLegs = routeLegs.filter(
    (leg): leg is RouteQueryRideLeg => leg.type === "ride"
  );

  return {
    id: `${input.candidate.accessStop.stop.stopId}:${input.candidate.destinationStop.stop.stopId}:${rideLegs.map((leg) => leg.id).join("|")}`,
    summary: "",
    recommendationLabel: input.initialRecommendationLabel,
    highlights: [],
    totalDurationMinutes: routeLegs.reduce((total, leg) => total + leg.durationMinutes, 0),
    totalFare,
    fareConfidence: pricedRideLegs.fareConfidence,
    transferCount: Math.max(0, rideLegs.length - 1),
    corridorTags: [...new Set(rideLegs.flatMap((leg) => leg.corridorTags))],
    fareAssumptions: pricedRideLegs.fareAssumptions,
    legs: routeLegs,
    relevantIncidents: [],
    source: "sakai",
    navigationTarget: buildNavigationTarget({
      normalizedQuery: input.normalizedQuery,
      rideLegs
    })
  };
};

export const queryTransitRoutesIfPossible = async (input: {
  origin: RouteQueryPointInput;
  destination: RouteQueryPointInput;
  preference: EffectiveValue<RoutePreference>;
  passengerType: EffectiveValue<PassengerType>;
  modifiers: EffectiveValue<RouteModifier[]>;
}): Promise<RouteQueryResult | null> => {
  const [originResolution, destinationResolution] = await Promise.all([
    resolveTransitEndpoint("origin", input.origin),
    resolveTransitEndpoint("destination", input.destination)
  ]);

  if (!originResolution || !destinationResolution) {
    return null;
  }

  const normalizedQuery: RouteQueryNormalizedInput = {
    origin: originResolution.normalizedPoint,
    destination: destinationResolution.normalizedPoint,
    preference: input.preference.value,
    passengerType: input.passengerType.value,
    preferenceSource: input.preference.source,
    passengerTypeSource: input.passengerType.source,
    modifiers: input.modifiers.value,
    modifierSource: input.modifiers.source
  };

  const destinationMap = new Map(
    destinationResolution.accessStops.map((accessStop) => [accessStop.stop.stopId, accessStop])
  );
  const queue: TransitPathState[] = originResolution.accessStops.map((accessStop) => ({
    currentStopId: accessStop.stop.stopId,
    totalWeight: accessStop.durationMinutes,
    totalDistanceMeters: accessStop.distanceMeters,
    rideBoardings: 0,
    rawEdges: [],
    visitedStopIds: new Set([accessStop.stop.stopId]),
    lastServiceKey: null
  }));
  const outgoingEdgeCache = new Map<string, transitGraphModel.TransitStopEdge[]>();
  const candidates: TransitCandidate[] = [];

  for (let index = 0; index < queue.length && queue.length <= MAX_TRANSIT_QUEUE_SIZE; index += 1) {
    queue.sort((left, right) => left.totalWeight - right.totalWeight);
    const state = queue.shift();

    if (!state) {
      break;
    }

    const destinationStop = destinationMap.get(state.currentStopId);

    if (destinationStop && state.rawEdges.length > 0) {
      const originAccessStop = originResolution.accessStops.find(
        (accessStop) => accessStop.stop.stopId === state.rawEdges[0]?.sourceStopId
      ) ?? originResolution.accessStops[0];

      if (originAccessStop) {
        candidates.push({
          accessStop: originAccessStop,
          destinationStop,
          rawEdges: state.rawEdges,
          totalWeight: state.totalWeight + destinationStop.durationMinutes
        });
      }

      if (candidates.length >= MAX_TRANSIT_CANDIDATES) {
        break;
      }
    }

    if (state.rawEdges.length >= MAX_TRANSIT_EDGES || state.rideBoardings >= MAX_TRANSIT_RIDE_BOARDINGS) {
      continue;
    }

    let outgoingEdges = outgoingEdgeCache.get(state.currentStopId);

    if (!outgoingEdges) {
      const fetchedOutgoingEdges = await transitGraphModel
        .listTransitEdgesBySourceStopIds([state.currentStopId])
        .catch((error) => {
          if (transitGraphModel.isTransitGraphUnavailableError(error)) {
            warnOnce("transit_route_query_edge_fallback", "Transit edge lookup unavailable; skipping transit planner", {
              operation: "transit_route_query_edge_fallback",
              reason: error instanceof Error ? error.message : "unknown error"
            });
            return null;
          }

          throw error;
        });

      if (fetchedOutgoingEdges === null) {
        return null;
      }

      outgoingEdges = fetchedOutgoingEdges;
      outgoingEdgeCache.set(state.currentStopId, outgoingEdges);
    }

    if (!outgoingEdges) {
      continue;
    }

    for (const edge of outgoingEdges) {
      const nextStopId = edge.targetStopId;

      if (state.visitedStopIds.has(nextStopId)) {
        continue;
      }

      const serviceKey = edge.transfer ? null : getServiceKey(edge);
      const nextRideBoardings =
        edge.transfer
          ? state.rideBoardings
          : state.lastServiceKey === serviceKey
            ? state.rideBoardings
            : state.rideBoardings + 1;

      if (nextRideBoardings > MAX_TRANSIT_RIDE_BOARDINGS) {
        continue;
      }

      queue.push({
        currentStopId: nextStopId,
        totalWeight: state.totalWeight + edge.weight,
        totalDistanceMeters: state.totalDistanceMeters + edge.distanceMeters,
        rideBoardings: nextRideBoardings,
        rawEdges: [...state.rawEdges, edge],
        visitedStopIds: new Set([...state.visitedStopIds, nextStopId]),
        lastServiceKey: serviceKey
      });
    }
  }

  if (candidates.length === 0) {
    return {
      normalizedQuery,
      options: [],
      googleFallback: {
        status: "skipped",
        options: []
      },
      message: `No supported route found for ${normalizedQuery.origin.label} to ${normalizedQuery.destination.label} in the current coverage`
    };
  }

  const routeOptions = (
    await Promise.all(
      candidates.map((candidate) =>
        buildTransitRouteOption({
          candidate,
          normalizedQuery,
          passengerType: normalizedQuery.passengerType,
          initialRecommendationLabel: "Alternative option"
        })
      )
    )
  ).filter((option): option is RouteQueryOption => option !== null);

  const optionsWithIncidents = await attachRelevantIncidentsToOptions({
    options: rankRouteOptions(routeOptions, normalizedQuery.preference, normalizedQuery.modifiers),
    normalizedQuery
  });
  const summarizedOptions = await Promise.all(
    optionsWithIncidents.map(async (option) => ({
      ...option,
      summary: await generateRouteSummary({
        option,
        normalizedQuery
      })
    }))
  );

  return {
    normalizedQuery,
    options: summarizedOptions,
    googleFallback: {
      status: "skipped",
      options: []
    }
  };
};
