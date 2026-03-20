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
import {
  buildFallbackGeometry,
  fetchORSGeometry,
  type GeometryCoordinate
} from "./ors-geometry.service.js";
import {
  buildRuntimeManualInterchangeEdges,
  getStopFamily,
  getTransitEdgeTraversalWeight,
  listAllManualInterchangeStopNames,
  listRuntimeManualInterchangeCounterpartQueries
} from "./route-planner-rules.js";
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

type TransitPlannerAttemptStatus = "success" | "no_candidates" | "unavailable";

interface TransitEndpointAttempt {
  resolution: TransitEndpointResolution | null;
  status: "resolved" | "no_candidates" | "unavailable";
  reason: string;
}

interface TransitPlannerTraceSummary {
  requestId: string;
  originInputLabel: string;
  destinationInputLabel: string;
  originResolutionStatus: string;
  destinationResolutionStatus: string;
  originAccessStopIds: string[];
  destinationAccessStopIds: string[];
  edgeLookupCount: number;
  exploredStateCount: number;
  candidateCount: number;
  droppedCandidateCount: number;
  manualInterchangeEdgeCount: number;
  queueCapHit: boolean;
  finalReason: string;
}

export interface TransitPlannerAttempt {
  status: TransitPlannerAttemptStatus;
  result: RouteQueryResult | null;
  traceSummary: TransitPlannerTraceSummary;
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

interface TransitRideLegBlueprint {
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
  pathCoordinates?: GeometryCoordinate[];
}

const WALKING_METERS_PER_MINUTE = 80;
const MAX_ACCESS_DISTANCE_METERS = 800;
const MAX_ACCESS_STOPS = 4;
const MAX_TRANSIT_QUEUE_SIZE = 2000;
const MAX_TRANSIT_CANDIDATES = 30;
const MAX_TRANSIT_RIDE_BOARDINGS = 4;
const MAX_TRANSIT_EDGES = 18;
const SUPPORTED_TRANSIT_MODES = new Set(["jeep", "jeepney", "uv", "mrt3", "lrt1", "lrt2", "lrt", "mrt", "transfer"]);
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

const createTransitRequestId = () =>
  `transit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const logTransitTrace = (
  message: string,
  trace: TransitPlannerTraceSummary,
  details: Record<string, unknown> = {}
) => {
  console.info(message, {
    operation: "transit_route_query_trace",
    requestId: trace.requestId,
    ...details
  });
};

const setTraceResolutionStatus = (
  trace: TransitPlannerTraceSummary,
  field: "origin" | "destination",
  status: string
) => {
  if (field === "origin") {
    trace.originResolutionStatus = status;
    return;
  }

  trace.destinationResolutionStatus = status;
};

const setTraceAccessStopIds = (
  trace: TransitPlannerTraceSummary,
  field: "origin" | "destination",
  stopIds: string[]
) => {
  if (field === "origin") {
    trace.originAccessStopIds = stopIds;
    return;
  }

  trace.destinationAccessStopIds = stopIds;
};

const getTraceAccessStopIds = (
  trace: TransitPlannerTraceSummary,
  field: "origin" | "destination"
) => (field === "origin" ? trace.originAccessStopIds : trace.destinationAccessStopIds);

const createWalkFareBreakdown = () => ({
  amount: 0,
  pricingType: "official" as const,
  fareProductCode: null,
  ruleVersionName: null,
  effectivityDate: null,
  isDiscountApplied: false,
  assumptionText: null
});

const normalizeTransitText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export const mapTransitModeToRideMode = (input: {
  mode: string;
  line?: string | null;
  routeShortName?: string | null;
  routeLongName?: string | null;
}) => {
  const normalizedMode = normalizeTransitText(input.mode);
  const normalizedLine = normalizeTransitText(input.line);
  const routeText = [
    normalizeTransitText(input.routeShortName),
    normalizeTransitText(input.routeLongName),
    normalizedLine
  ]
    .filter(Boolean)
    .join(" ");

  if (normalizedMode === "jeep" || normalizedMode === "jeepney") {
    return "jeepney" as const;
  }

  if (normalizedMode === "uv") {
    return "uv" as const;
  }

  if (
    normalizedMode === "mrt3" ||
    normalizedLine.includes("mrt3") ||
    routeText.includes("mrt-3") ||
    routeText.includes("mrt 3")
  ) {
    return "mrt3" as const;
  }

  if (
    normalizedMode === "lrt2" ||
    normalizedLine.includes("lrt2") ||
    routeText.includes("lrt-2") ||
    routeText.includes("lrt 2")
  ) {
    return "lrt2" as const;
  }

  if (
    normalizedMode === "lrt1" ||
    normalizedLine.includes("lrt1") ||
    routeText.includes("lrt-1") ||
    routeText.includes("lrt 1")
  ) {
    return "lrt1" as const;
  }

  if (routeText.includes("pnr") || routeText.includes("metro commuter")) {
    return null;
  }

  if (normalizedMode === "mrt") {
    return "mrt3" as const;
  }

  if (normalizedMode === "lrt") {
    return "lrt1" as const;
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

const buildRawEdgePathCoordinates = (
  edges: transitGraphModel.TransitStopEdge[],
  stopMap: Map<string, transitGraphModel.TransitStop>
) => {
  const coordinates: GeometryCoordinate[] = [];

  for (const edge of edges) {
    const fromStop = stopMap.get(edge.sourceStopId);
    const toStop = stopMap.get(edge.targetStopId);

    if (fromStop && coordinates.length === 0) {
      coordinates.push({
        latitude: fromStop.latitude,
        longitude: fromStop.longitude
      });
    }

    if (toStop) {
      coordinates.push({
        latitude: toStop.latitude,
        longitude: toStop.longitude
      });
    }
  }

  return buildFallbackGeometry(coordinates);
};

const resolveRidePathCoordinates = async (input: {
  rideMode: RouteQueryRideLeg["mode"];
  edges: transitGraphModel.TransitStopEdge[];
  stopMap: Map<string, transitGraphModel.TransitStop>;
}) => {
  const fallbackGeometry = buildRawEdgePathCoordinates(input.edges, input.stopMap);

  if (!fallbackGeometry) {
    return undefined;
  }

  if (input.rideMode === "jeepney" || input.rideMode === "uv") {
    return (
      (await fetchORSGeometry({
        profile: "driving-car",
        coordinates: fallbackGeometry
      })) ?? fallbackGeometry
    );
  }

  return fallbackGeometry;
};

const resolveWalkPathCoordinates = async (input: {
  edge: transitGraphModel.TransitStopEdge;
  stopMap: Map<string, transitGraphModel.TransitStop>;
}) => {
  const fromStop = input.stopMap.get(input.edge.sourceStopId);
  const toStop = input.stopMap.get(input.edge.targetStopId);

  if (!fromStop || !toStop) {
    return undefined;
  }

  const fallbackGeometry = buildFallbackGeometry([
    {
      latitude: fromStop.latitude,
      longitude: fromStop.longitude
    },
    {
      latitude: toStop.latitude,
      longitude: toStop.longitude
    }
  ]);

  if (!fallbackGeometry) {
    return undefined;
  }

  return (
    (await fetchORSGeometry({
      profile: "foot-walking",
      coordinates: fallbackGeometry
    })) ?? fallbackGeometry
  );
};

const toRouteStop = (
  stop: transitGraphModel.TransitStop,
  clusterId: string | null
): Stop => ({
  id: stop.stopId,
  placeId: clusterId,
  externalStopCode: stop.stopId,
  stopName: stop.stopName,
  mode: mapTransitModeToRideMode({
    mode: stop.mode,
    line: stop.line
  }) ?? "walk_anchor",
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
  pathCoordinates?: GeometryCoordinate[];
}): RouteQueryWalkLeg => ({
  type: "walk",
  id: input.id,
  fromLabel: input.fromLabel,
  toLabel: input.toLabel,
  distanceMeters: Math.round(input.distanceMeters),
  durationMinutes: input.durationMinutes,
  fare: createWalkFareBreakdown(),
  pathCoordinates: input.pathCoordinates
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

const buildAccessStopsFromDirectStopMatch = async (label: string) => {
  const matchedStops = await transitGraphModel.searchTransitStopsByQuery(label, {
    limit: MAX_ACCESS_STOPS
  });

  return matchedStops.map((stop) => ({
    stop,
    distanceMeters: 0,
    durationMinutes: 0,
    fromLabel: label
  }));
};

const buildDirectMatchNormalizedPoint = (input: {
  field: "origin" | "destination";
  label: string;
  fallbackPlaceId?: string;
  fallbackMatchedBy?: RouteQueryNormalizedInput["origin"]["matchedBy"];
  accessStops: TransitAccessStop[];
}) => {
  const firstStop = input.accessStops[0]?.stop;

  return {
    placeId:
      input.fallbackPlaceId ??
      (firstStop ? `cluster:${firstStop.normalizedName}` : `coords:${input.field}`),
    label: input.label,
    matchedBy: input.fallbackMatchedBy ?? "canonicalName",
    latitude: firstStop?.latitude ?? 0,
    longitude: firstStop?.longitude ?? 0
  } satisfies RouteQueryNormalizedInput["origin"];
};

const resolveTransitEndpoint = async (
  field: "origin" | "destination",
  point: RouteQueryPointInput,
  trace: TransitPlannerTraceSummary
): Promise<TransitEndpointAttempt> => {
  const clusterPlaceId = point.placeId?.startsWith("cluster:") ? point.placeId : undefined;
  const shouldAttemptTransit =
    Boolean(clusterPlaceId) ||
    (typeof point.latitude === "number" && typeof point.longitude === "number");

  if (!shouldAttemptTransit) {
    setTraceResolutionStatus(trace, field, "no_candidates:transit_not_applicable");
    return {
      resolution: null,
      status: "no_candidates",
      reason: "transit_not_applicable"
    };
  }

  let clusterResolution;

  try {
    clusterResolution = await placeModel.resolvePlaceReference({
      placeId: clusterPlaceId,
      googlePlaceId: point.googlePlaceId,
      query: point.label
    });
  } catch (error) {
    if (transitGraphModel.isTransitGraphUnavailableError(error)) {
      warnOnce("transit_route_query_resolution_fallback", "Transit endpoint resolution unavailable; skipping transit planner", {
        operation: "transit_route_query_resolution_fallback",
        reason: error instanceof Error ? error.message : "unknown error"
      });
      setTraceResolutionStatus(trace, field, "unavailable:place_resolution_failed");
      return {
        resolution: null,
        status: "unavailable",
        reason: "place_resolution_failed"
      };
    }

    throw error;
  }

  if (!clusterResolution) {
    setTraceResolutionStatus(trace, field, "no_candidates:empty_place_resolution");
    return {
      resolution: null,
      status: "no_candidates",
      reason: "empty_place_resolution"
    };
  }

  if (clusterResolution.status === "ambiguous") {
    throw new HttpError(422, `${field} matches multiple supported places`, {
      field,
      status: "ambiguous",
      matches: clusterResolution.matches
    });
  }

  const fallbackLabel =
    clusterResolution.status === "resolved"
      ? clusterResolution.place.canonicalName
      : point.label ?? (field === "origin" ? "Current location" : "Destination");

  if (clusterResolution.status === "resolved" && clusterResolution.place.id.startsWith("cluster:")) {
    const clusterAccessStops = await buildAccessStopsFromCluster(
      clusterResolution.place.id,
      clusterResolution.place.canonicalName
    ).catch((error) => {
      if (transitGraphModel.isTransitGraphUnavailableError(error)) {
        warnOnce("transit_route_query_cluster_fallback", "Transit cluster access unavailable; skipping transit planner", {
          operation: "transit_route_query_cluster_fallback",
          reason: error instanceof Error ? error.message : "unknown error"
        });
        return null;
      }

      throw error;
    });

    if (clusterAccessStops === null) {
      setTraceResolutionStatus(trace, field, "unavailable:cluster_access_failed");
      return {
        resolution: null,
        status: "unavailable",
        reason: "cluster_access_failed"
      };
    }

    if (clusterAccessStops.length > 0) {
      setTraceResolutionStatus(trace, field, "resolved:cluster");
      setTraceAccessStopIds(
        trace,
        field,
        clusterAccessStops.map((accessStop) => accessStop.stop.stopId)
      );
      logTransitTrace("Transit endpoint resolved from cluster", trace, {
        field,
        placeId: clusterResolution.place.id,
        accessStopIds: getTraceAccessStopIds(trace, field)
      });

      return {
        resolution: {
          normalizedPoint: {
            placeId: clusterResolution.place.id,
            label: clusterResolution.place.canonicalName,
            matchedBy: clusterResolution.place.matchedBy,
            latitude: clusterResolution.place.latitude,
            longitude: clusterResolution.place.longitude
          },
          accessStops: clusterAccessStops
        },
        status: "resolved",
        reason: "cluster_access"
      };
    }

    logTransitTrace("Transit cluster resolved but had no member stops; retrying fallback access lookup", trace, {
      field,
      placeId: clusterResolution.place.id
    });
  }

  const coordinatePoint =
    clusterResolution.status === "resolved"
      ? {
          ...point,
          latitude: point.latitude ?? clusterResolution.place.latitude,
          longitude: point.longitude ?? clusterResolution.place.longitude
        }
      : point;
  const coordinateAccessStops = await buildAccessStopsFromCoordinates(coordinatePoint, fallbackLabel).catch(
    (error) => {
      if (transitGraphModel.isTransitGraphUnavailableError(error)) {
        warnOnce("transit_route_query_nearest_stop_fallback", "Transit nearby-stop access unavailable; skipping transit planner", {
          operation: "transit_route_query_nearest_stop_fallback",
          reason: error instanceof Error ? error.message : "unknown error"
        });
        return null;
      }

      throw error;
    }
  );

  if (coordinateAccessStops === null) {
    setTraceResolutionStatus(trace, field, "unavailable:nearest_stop_lookup_failed");
    return {
      resolution: null,
      status: "unavailable",
      reason: "nearest_stop_lookup_failed"
    };
  }

  if (coordinateAccessStops.length > 0) {
    setTraceResolutionStatus(trace, field, "resolved:nearest_stop");
    setTraceAccessStopIds(
      trace,
      field,
      coordinateAccessStops.map((accessStop) => accessStop.stop.stopId)
    );
    logTransitTrace("Transit endpoint resolved from nearby stops", trace, {
      field,
      accessStopIds: getTraceAccessStopIds(trace, field)
    });

    return {
      resolution: {
        normalizedPoint: {
          placeId: clusterResolution.status === "resolved" ? clusterResolution.place.id : `coords:${field}`,
          label:
            clusterResolution.status === "resolved"
              ? clusterResolution.place.canonicalName
              : fallbackLabel,
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
      },
      status: "resolved",
      reason: "nearest_stop_access"
    };
  }

  if (fallbackLabel.trim()) {
    const directMatchAccessStops = await buildAccessStopsFromDirectStopMatch(fallbackLabel).catch((error) => {
      if (transitGraphModel.isTransitGraphUnavailableError(error)) {
        warnOnce("transit_route_query_direct_stop_match_fallback", "Transit direct stop search unavailable; skipping transit planner", {
          operation: "transit_route_query_direct_stop_match_fallback",
          reason: error instanceof Error ? error.message : "unknown error"
        });
        return null;
      }

      throw error;
    });

    if (directMatchAccessStops === null) {
      setTraceResolutionStatus(trace, field, "unavailable:direct_stop_match_failed");
      return {
        resolution: null,
        status: "unavailable",
        reason: "direct_stop_match_failed"
      };
    }

    if (directMatchAccessStops.length > 0) {
      setTraceResolutionStatus(trace, field, "resolved:direct_stop_match");
      setTraceAccessStopIds(
        trace,
        field,
        directMatchAccessStops.map((accessStop) => accessStop.stop.stopId)
      );
      logTransitTrace("Transit endpoint resolved from direct stop-name match", trace, {
        field,
        label: fallbackLabel,
        accessStopIds: getTraceAccessStopIds(trace, field)
      });

      return {
        resolution: {
          normalizedPoint: buildDirectMatchNormalizedPoint({
            field,
            label: fallbackLabel,
            fallbackPlaceId:
              clusterResolution.status === "resolved" ? clusterResolution.place.id : undefined,
            fallbackMatchedBy:
              clusterResolution.status === "resolved"
                ? clusterResolution.place.matchedBy
                : "canonicalName",
            accessStops: directMatchAccessStops
          }),
          accessStops: directMatchAccessStops
        },
        status: "resolved",
        reason: "direct_stop_match"
      };
    }
  }

  setTraceResolutionStatus(trace, field, "no_candidates:no_access_stops");
  return {
    resolution: null,
    status: "no_candidates",
    reason: "no_access_stops"
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
  const rideLegBlueprints: TransitRideLegBlueprint[] = [];
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
          durationMinutes: roundMinutes(rawLeg.edge.estimatedTimeMinutes),
          pathCoordinates: await resolveWalkPathCoordinates({
            edge: rawLeg.edge,
            stopMap
          })
        })
      );
      continue;
    }

    const firstEdge = rawLeg.edges[0];
    const lastEdge = rawLeg.edges.at(-1);

    if (!firstEdge || !lastEdge) {
      return null;
    }

    const rideMode = mapTransitModeToRideMode({
      mode: firstEdge.mode,
      line: firstEdge.line,
      routeShortName: firstEdge.routeShortName,
      routeLongName: firstEdge.routeLongName
    });

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
      fromStop: {
        ...toRouteStop(fromTransitStop, input.normalizedQuery.origin.placeId),
        mode: rideMode
      },
      toStop: {
        ...toRouteStop(toTransitStop, input.normalizedQuery.destination.placeId),
        mode: rideMode
      },
      fareProductCode,
      pathCoordinates: await resolveRidePathCoordinates({
        rideMode,
        edges: rawLeg.edges,
        stopMap
      })
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
      fare,
      pathCoordinates: rideLeg.pathCoordinates
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
}): Promise<TransitPlannerAttempt> => {
  const trace: TransitPlannerTraceSummary = {
    requestId: createTransitRequestId(),
    originInputLabel: input.origin.label ?? input.origin.placeId ?? "origin",
    destinationInputLabel: input.destination.label ?? input.destination.placeId ?? "destination",
    originResolutionStatus: "pending",
    destinationResolutionStatus: "pending",
    originAccessStopIds: [],
    destinationAccessStopIds: [],
    edgeLookupCount: 0,
    exploredStateCount: 0,
    candidateCount: 0,
    droppedCandidateCount: 0,
    manualInterchangeEdgeCount: 0,
    queueCapHit: false,
    finalReason: "pending"
  };

  logTransitTrace("Transit planner started", trace, {
    origin: input.origin,
    destination: input.destination,
    preference: input.preference.value,
    modifiers: input.modifiers.value
  });

  const [originAttempt, destinationAttempt] = await Promise.all([
    resolveTransitEndpoint("origin", input.origin, trace),
    resolveTransitEndpoint("destination", input.destination, trace)
  ]);

  if (originAttempt.status === "unavailable" || destinationAttempt.status === "unavailable") {
    trace.finalReason =
      originAttempt.status === "unavailable"
        ? `origin_${originAttempt.reason}`
        : `destination_${destinationAttempt.reason}`;
    logTransitTrace("Transit planner unavailable; route query should fall back", trace, {
      traceSummary: trace
    });

    return {
      status: "unavailable",
      result: null,
      traceSummary: trace
    };
  }

  if (!originAttempt.resolution || !destinationAttempt.resolution) {
    trace.finalReason =
      !originAttempt.resolution
        ? `origin_${originAttempt.reason}`
        : `destination_${destinationAttempt.reason}`;
    logTransitTrace("Transit planner found no usable endpoint access; route query should fall back", trace, {
      traceSummary: trace
    });

    return {
      status: "no_candidates",
      result: null,
      traceSummary: trace
    };
  }

  const originResolution = originAttempt.resolution;
  const destinationResolution = destinationAttempt.resolution;

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
  const knownTransitStops = new Map<string, transitGraphModel.TransitStop>(
    [...originResolution.accessStops, ...destinationResolution.accessStops].map((accessStop) => [
      accessStop.stop.stopId,
      accessStop.stop
    ])
  );
  const originFamily = getStopFamily(originResolution.accessStops[0]?.stop ?? { mode: "walk_anchor" });
  const destinationFamily = getStopFamily(
    destinationResolution.accessStops[0]?.stop ?? { mode: "walk_anchor" }
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
  const preloadedManualInterchangeEdgeCache = new Map<string, transitGraphModel.TransitStopEdge[]>();
  const manualInterchangeStopCache = new Map<string, transitGraphModel.TransitStop[]>();
  const candidates: TransitCandidate[] = [];
  const bestWeightToStop = new Map<string, number>();

  for (const accessStop of originResolution.accessStops) {
    bestWeightToStop.set(accessStop.stop.stopId, accessStop.durationMinutes);
  }

  // Pre-resolve all manual interchange stops before the main loop
  // (matches the simulator's add_manual_interchanges approach)
  for (const interchangeName of listAllManualInterchangeStopNames()) {
    if (manualInterchangeStopCache.has(interchangeName)) {
      continue;
    }

    let resolution:
      | Awaited<ReturnType<typeof placeModel.resolvePlaceReference>>
      | null = null;

    try {
      resolution = await placeModel.resolvePlaceReference({
        query: interchangeName
      });
    } catch {
      resolution = null;
    }

    if (resolution?.status === "resolved" && resolution.place.id.startsWith("cluster:")) {
      const counterpartStops = await transitGraphModel
        .listTransitStopsByClusterId(resolution.place.id)
        .catch(() => [] as transitGraphModel.TransitStop[]);

      manualInterchangeStopCache.set(interchangeName, counterpartStops);

      for (const stop of counterpartStops) {
        knownTransitStops.set(stop.stopId, stop);
      }
    } else {
      manualInterchangeStopCache.set(interchangeName, []);
    }
  }

  // Preload manual interchange edges separately so normal edge fetches still happen.
  for (const stop of knownTransitStops.values()) {
    const interchangeEdges = buildRuntimeManualInterchangeEdges(stop.stopId, knownTransitStops);

    if (interchangeEdges.length > 0) {
      preloadedManualInterchangeEdgeCache.set(stop.stopId, interchangeEdges);
      trace.manualInterchangeEdgeCount += interchangeEdges.length;
    }
  }

  logTransitTrace("Transit planner preloaded manual interchange edges", trace, {
    interchangeEdgeCount: trace.manualInterchangeEdgeCount,
    knownStopCount: knownTransitStops.size
  });

  let processedStateCount = 0;

  while (
    queue.length > 0 &&
    queue.length <= MAX_TRANSIT_QUEUE_SIZE &&
    processedStateCount < MAX_TRANSIT_QUEUE_SIZE
  ) {
    queue.sort((left, right) => left.totalWeight - right.totalWeight);
    const state = queue.shift();

    if (!state) {
      break;
    }

    processedStateCount += 1;
    trace.exploredStateCount = processedStateCount;

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
        trace.candidateCount = candidates.length;
        logTransitTrace("Transit planner found a route candidate", trace, {
          currentStopId: state.currentStopId,
          candidateCount: candidates.length
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
        trace.finalReason = "permission_denied_transit_tables";
        logTransitTrace("Transit edge lookup failed; route query should fall back", trace, {
          stopId: state.currentStopId
        });

        return {
          status: "unavailable",
          result: null,
          traceSummary: trace
        };
      }

      const preloadedManualEdges = preloadedManualInterchangeEdgeCache.get(state.currentStopId) ?? [];

      outgoingEdges = [...fetchedOutgoingEdges];

      for (const manualEdge of preloadedManualEdges) {
        if (
          !outgoingEdges.some(
            (existingEdge) =>
              existingEdge.sourceStopId === manualEdge.sourceStopId &&
              existingEdge.targetStopId === manualEdge.targetStopId &&
              existingEdge.line === manualEdge.line &&
              existingEdge.mode === manualEdge.mode
          )
        ) {
          outgoingEdges.push(manualEdge);
        }
      }

      outgoingEdgeCache.set(state.currentStopId, outgoingEdges);
      trace.edgeLookupCount += 1;
      logTransitTrace("Transit planner fetched outgoing edges", trace, {
        stopId: state.currentStopId,
        edgeCount: outgoingEdges.length
      });
    }

    if (!outgoingEdges) {
      continue;
    }

    const missingStopIds = [...new Set(
      outgoingEdges.flatMap((edge) => [edge.sourceStopId, edge.targetStopId])
    )].filter((stopId) => !knownTransitStops.has(stopId));

    if (missingStopIds.length > 0) {
      const hydratedStops = await transitGraphModel.listTransitStopsByIds(missingStopIds).catch((error) => {
        if (transitGraphModel.isTransitGraphUnavailableError(error)) {
          warnOnce("transit_route_query_stop_cache_fallback", "Transit stop cache hydration unavailable during planning", {
            operation: "transit_route_query_stop_cache_fallback",
            reason: error instanceof Error ? error.message : "unknown error"
          });
          return [];
        }

        throw error;
      });

      for (const stop of hydratedStops) {
        knownTransitStops.set(stop.stopId, stop);
      }
    }

    const currentTransitStop = knownTransitStops.get(state.currentStopId);

    if (currentTransitStop) {
      for (const query of listRuntimeManualInterchangeCounterpartQueries(currentTransitStop.stopName)) {
        let counterpartStops = manualInterchangeStopCache.get(query);

        if (!counterpartStops) {
          let resolution:
            | Awaited<ReturnType<typeof placeModel.resolvePlaceReference>>
            | null = null;

          try {
            resolution = await placeModel.resolvePlaceReference({
              query
            });
          } catch {
            resolution = null;
          }

          if (resolution?.status === "resolved" && resolution.place.id.startsWith("cluster:")) {
            counterpartStops = await transitGraphModel
              .listTransitStopsByClusterId(resolution.place.id)
              .catch(() => []);
          } else {
            counterpartStops = [];
          }

          manualInterchangeStopCache.set(query, counterpartStops);
        }

        for (const stop of counterpartStops) {
          knownTransitStops.set(stop.stopId, stop);
        }
      }
    }

    const augmentedOutgoingEdges = [...outgoingEdges];

    for (const manualEdge of buildRuntimeManualInterchangeEdges(state.currentStopId, knownTransitStops)) {
      if (
        !augmentedOutgoingEdges.some(
          (existingEdge) =>
            existingEdge.sourceStopId === manualEdge.sourceStopId &&
            existingEdge.targetStopId === manualEdge.targetStopId &&
            existingEdge.line === manualEdge.line &&
            existingEdge.mode === manualEdge.mode
        )
      ) {
        augmentedOutgoingEdges.push(manualEdge);
        trace.manualInterchangeEdgeCount += 1;
      }
    }

    for (const edge of augmentedOutgoingEdges) {
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

      const nextWeight =
          state.totalWeight +
          getTransitEdgeTraversalWeight({
            edge,
            sourceStop: knownTransitStops.get(edge.sourceStopId),
            targetStop: knownTransitStops.get(edge.targetStopId),
            preference: normalizedQuery.preference,
            modifiers: normalizedQuery.modifiers,
            originFamily,
            destinationFamily
          });

      const existingBest = bestWeightToStop.get(nextStopId);

      if (existingBest !== undefined && nextWeight >= existingBest) {
        continue;
      }

      bestWeightToStop.set(nextStopId, nextWeight);

      queue.push({
        currentStopId: nextStopId,
        totalWeight: nextWeight,
        totalDistanceMeters: state.totalDistanceMeters + edge.distanceMeters,
        rideBoardings: nextRideBoardings,
        rawEdges: [...state.rawEdges, edge],
        visitedStopIds: new Set([...state.visitedStopIds, nextStopId]),
        lastServiceKey: serviceKey
      });
    }
  }

  trace.queueCapHit = queue.length > MAX_TRANSIT_QUEUE_SIZE || processedStateCount >= MAX_TRANSIT_QUEUE_SIZE;

  if (candidates.length === 0) {
    trace.finalReason = trace.queueCapHit ? "queue_cap_hit" : "transit_no_candidates_fallback";
    logTransitTrace("Transit planner found no candidates; route query should fall back", trace, {
      normalizedQuery,
      traceSummary: trace
    });

    return {
      status: "no_candidates",
      result: null,
      traceSummary: trace
    };
  }

  let droppedCandidateCount = 0;

  const routeOptions = (
    await Promise.all(
      candidates.map(async (candidate) => {
        try {
          return await buildTransitRouteOption({
            candidate,
            normalizedQuery,
            passengerType: normalizedQuery.passengerType,
            initialRecommendationLabel: "Alternative option"
          });
        } catch (error) {
          if (error instanceof HttpError) {
            droppedCandidateCount += 1;
            console.warn("Dropped transit route candidate during option building", {
              operation: "transit_route_query_option_drop",
              reason: error.message
            });
            return null;
          }

          throw error;
        }
      })
    )
  ).filter((option): option is RouteQueryOption => option !== null);
  trace.droppedCandidateCount = droppedCandidateCount;

  if (routeOptions.length === 0) {
    trace.finalReason = "all_candidates_dropped";
    logTransitTrace("Transit planner dropped all candidates; route query should fall back", trace, {
      normalizedQuery,
      traceSummary: trace
    });

    return {
      status: "no_candidates",
      result: null,
      traceSummary: trace
    };
  }

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
  trace.finalReason = "transit_success";
  logTransitTrace("Transit planner succeeded", trace, {
    optionCount: summarizedOptions.length,
    normalizedQuery
  });

  return {
    status: "success",
    result: {
      normalizedQuery,
      options: summarizedOptions,
      googleFallback: {
        status: "skipped",
        options: []
      }
    },
    traceSummary: trace
  };
};
