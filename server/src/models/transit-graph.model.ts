import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import type { Coordinates, PlaceKind, PlaceMatch } from "../types/route-network.js";
import type { Database } from "../types/database.js";

type TransitStopRow = Database["public"]["Tables"]["transit_stops"]["Row"];
type TransitStopEdgeRow = Database["public"]["Tables"]["transit_stop_edges"]["Row"];

const isTransitPermissionError = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("permission denied") &&
    (normalizedMessage.includes("table transit_stops") ||
      normalizedMessage.includes("table transit_stop_edges"))
  );
};

export const isTransitGraphUnavailableError = (error: unknown) =>
  error instanceof HttpError &&
  typeof error.message === "string" &&
  isTransitPermissionError(error.message);

export interface TransitStop {
  stopId: string;
  stopName: string;
  normalizedName: string;
  latitude: number;
  longitude: number;
  mode: string;
  line: string;
  allModes: string[];
  allLines: string[];
  isMultimodal: boolean;
  lineCount: number;
  createdAt: string;
}

export interface TransitStopCluster extends PlaceMatch {
  memberStopIds: string[];
  modes: string[];
  lines: string[];
}

export interface TransitStopEdge {
  sourceStopId: string;
  targetStopId: string;
  weight: number;
  mode: string;
  line: string;
  routeShortName: string | null;
  routeLongName: string | null;
  transfer: boolean;
  distanceMeters: number;
  estimatedTimeMinutes: number;
  dataSource: string;
  createdAt: string;
}

export interface TransitGraphCoverage {
  stopCount: number;
  edgeCount: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_DEGREE_LATITUDE = 111_320;
const CLUSTER_ID_PREFIX = "cluster:";

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceMeters = (origin: Coordinates, destination: Coordinates) => {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
};

const toClusterId = (normalizedName: string) => `${CLUSTER_ID_PREFIX}${normalizedName}`;

const normalizeSearchText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");

const toTitleCase = (value: string) =>
  value.replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

const parseCityFromStopName = (stopName: string) => {
  const segments = stopName.split(",").map((segment) => segment.trim()).filter(Boolean);

  return segments.at(-1) ?? "Metro Manila";
};

const getBaseAlias = (stopName: string) => stopName.split(",")[0]?.trim() ?? stopName;

const getClusterKind = (stops: TransitStop[]): PlaceKind => {
  if (stops.some((stop) => stop.isMultimodal)) {
    return "station";
  }

  if (stops.some((stop) => stop.mode.includes("mrt") || stop.mode.includes("lrt"))) {
    return "station";
  }

  if (stops.some((stop) => stop.lineCount > 1)) {
    return "terminal";
  }

  return "area";
};

const mapTransitStop = (row: TransitStopRow): TransitStop => ({
  stopId: row.stop_id,
  stopName: row.stop_name,
  normalizedName: row.normalized_name,
  latitude: row.lat,
  longitude: row.lon,
  mode: row.mode,
  line: row.line,
  allModes: row.all_modes.split("|").map((value) => value.trim()).filter(Boolean),
  allLines: row.all_lines.split("|").map((value) => value.trim()).filter(Boolean),
  isMultimodal: row.is_multimodal,
  lineCount: row.line_count,
  createdAt: row.created_at
});

const mapTransitEdge = (row: TransitStopEdgeRow): TransitStopEdge => ({
  sourceStopId: row.source_stop_id,
  targetStopId: row.target_stop_id,
  weight: row.weight,
  mode: row.mode,
  line: row.line,
  routeShortName: row.route_short_name,
  routeLongName: row.route_long_name,
  transfer: row.transfer,
  distanceMeters: row.distance_meters,
  estimatedTimeMinutes: row.estimated_time_min,
  dataSource: row.data_source,
  createdAt: row.created_at
});

const buildCluster = (stops: TransitStop[]): TransitStopCluster => {
  const sortedStops = [...stops].sort(
    (left, right) => left.stopName.localeCompare(right.stopName) || left.stopId.localeCompare(right.stopId)
  );
  const firstStop = sortedStops[0];

  if (!firstStop) {
    throw new HttpError(500, "Cannot build an empty transit stop cluster");
  }

  const canonicalLabel = getBaseAlias(firstStop.stopName);
  const memberStopIds = sortedStops.map((stop) => stop.stopId);

  return {
    id: toClusterId(firstStop.normalizedName),
    canonicalName: canonicalLabel,
    city: parseCityFromStopName(firstStop.stopName),
    kind: getClusterKind(sortedStops),
    latitude: sortedStops.reduce((total, stop) => total + stop.latitude, 0) / sortedStops.length,
    longitude: sortedStops.reduce((total, stop) => total + stop.longitude, 0) / sortedStops.length,
    googlePlaceId: null,
    createdAt: firstStop.createdAt,
    matchedBy: "canonicalName",
    matchedText: canonicalLabel,
    memberStopIds,
    modes: [...new Set(sortedStops.flatMap((stop) => stop.allModes))],
    lines: [...new Set(sortedStops.flatMap((stop) => stop.allLines))]
  };
};

const groupStopsIntoClusters = (stops: TransitStop[]) => {
  const clusterMap = new Map<string, TransitStop[]>();

  for (const stop of stops) {
    const existingStops = clusterMap.get(stop.normalizedName) ?? [];
    existingStops.push(stop);
    clusterMap.set(stop.normalizedName, existingStops);
  }

  return [...clusterMap.values()].map(buildCluster).sort(
    (left, right) => left.canonicalName.localeCompare(right.canonicalName) || left.id.localeCompare(right.id)
  );
};

const listTransitStopRowsByNormalizedName = async (normalizedName: string) => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("transit_stops")
    .select("*")
    .eq("normalized_name", normalizedName);

  if (error) {
    throw new HttpError(500, `Failed to fetch transit stops: ${error.message}`);
  }

  return ((data ?? []) as TransitStopRow[]).map(mapTransitStop);
};

export const searchTransitStopClusters = async (
  query: string,
  options: {
    limit?: number;
  } = {}
): Promise<TransitStopCluster[]> => {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const { data, error } = await client
    .from("transit_stops")
    .select("*")
    .or(`normalized_name.ilike.%${normalizedQuery}%,stop_name.ilike.%${query.trim()}%`)
    .limit(limit * 12);

  if (error) {
    throw new HttpError(500, `Failed to search transit stops: ${error.message}`);
  }

  return groupStopsIntoClusters(((data ?? []) as TransitStopRow[]).map(mapTransitStop)).slice(0, limit);
};

export const resolveTransitStopCluster = async (input: {
  clusterId?: string;
  query?: string;
}): Promise<
  | {
      status: "resolved";
      cluster: TransitStopCluster;
    }
  | {
      status: "ambiguous";
      matches: TransitStopCluster[];
    }
  | {
      status: "unresolved";
    }
> => {
  if (input.clusterId?.startsWith(CLUSTER_ID_PREFIX)) {
    const normalizedName = input.clusterId.slice(CLUSTER_ID_PREFIX.length);
    const stops = await listTransitStopRowsByNormalizedName(normalizedName);

    if (stops.length === 0) {
      return { status: "unresolved" };
    }

    return {
      status: "resolved",
      cluster: buildCluster(stops)
    };
  }

  if (!input.query) {
    return {
      status: "unresolved"
    };
  }

  const normalizedQuery = normalizeSearchText(input.query);
  const matches = await searchTransitStopClusters(input.query, {
    limit: 10
  });
  const exactMatches = matches.filter((match) => {
    const candidateTexts = [
      normalizeSearchText(match.canonicalName),
      normalizeSearchText(`${match.canonicalName} ${match.city}`),
      normalizeSearchText(match.matchedText)
    ];

    return candidateTexts.includes(normalizedQuery);
  });

  if (exactMatches.length === 1) {
    return {
      status: "resolved",
      cluster: exactMatches[0]
    };
  }

  if (exactMatches.length > 1) {
    return {
      status: "ambiguous",
      matches: exactMatches
    };
  }

  if (matches.length === 1) {
    return {
      status: "resolved",
      cluster: matches[0]
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      matches
    };
  }

  return {
    status: "unresolved"
  };
};

export const listTransitStopsByClusterId = async (clusterId: string): Promise<TransitStop[]> => {
  if (!clusterId.startsWith(CLUSTER_ID_PREFIX)) {
    return [];
  }

  return listTransitStopRowsByNormalizedName(clusterId.slice(CLUSTER_ID_PREFIX.length));
};

const rankTransitStopQueryMatch = (stop: TransitStop, normalizedQuery: string) => {
  const normalizedStopName = normalizeSearchText(stop.stopName);

  if (stop.normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedStopName === normalizedQuery) {
    return 1;
  }

  if (stop.normalizedName.startsWith(normalizedQuery)) {
    return 2;
  }

  if (normalizedStopName.startsWith(normalizedQuery)) {
    return 3;
  }

  if (stop.normalizedName.includes(normalizedQuery)) {
    return 4;
  }

  if (normalizedStopName.includes(normalizedQuery)) {
    return 5;
  }

  return 6;
};

export const searchTransitStopsByQuery = async (
  query: string,
  options: {
    limit?: number;
  } = {}
): Promise<TransitStop[]> => {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const { data, error } = await client
    .from("transit_stops")
    .select("*")
    .or(`normalized_name.ilike.%${normalizedQuery}%,stop_name.ilike.%${query.trim()}%`)
    .limit(limit * 8);

  if (error) {
    throw new HttpError(500, `Failed to search transit stops by query: ${error.message}`);
  }

  return ((data ?? []) as TransitStopRow[])
    .map(mapTransitStop)
    .sort(
      (left, right) =>
        rankTransitStopQueryMatch(left, normalizedQuery) - rankTransitStopQueryMatch(right, normalizedQuery) ||
        right.lineCount - left.lineCount ||
        Number(right.isMultimodal) - Number(left.isMultimodal) ||
        left.stopName.localeCompare(right.stopName) ||
        left.stopId.localeCompare(right.stopId)
    )
    .slice(0, limit);
};

export const listTransitStopsByIds = async (stopIds: string[]): Promise<TransitStop[]> => {
  if (stopIds.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("transit_stops")
    .select("*")
    .in("stop_id", [...new Set(stopIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch transit stops by id: ${error.message}`);
  }

  return ((data ?? []) as TransitStopRow[]).map(mapTransitStop);
};

export const findNearestTransitStops = async (input: {
  coordinates: Coordinates;
  limit: number;
  maxDistanceMeters?: number;
}): Promise<Array<TransitStop & { distanceMeters: number }>> => {
  const client = getSupabaseAdminClient();
  let query = client.from("transit_stops").select("*");

  if (input.maxDistanceMeters && input.maxDistanceMeters > 0) {
    const latitudeDelta = input.maxDistanceMeters / METERS_PER_DEGREE_LATITUDE;
    const longitudeDivisor = Math.max(
      Math.cos((input.coordinates.latitude * Math.PI) / 180) * METERS_PER_DEGREE_LATITUDE,
      1
    );
    const longitudeDelta = input.maxDistanceMeters / longitudeDivisor;

    query = query
      .gte("lat", input.coordinates.latitude - latitudeDelta)
      .lte("lat", input.coordinates.latitude + latitudeDelta)
      .gte("lon", input.coordinates.longitude - longitudeDelta)
      .lte("lon", input.coordinates.longitude + longitudeDelta);
  }

  const { data, error } = await query.limit(Math.max(input.limit * 4, input.limit));

  if (error) {
    throw new HttpError(500, `Failed to search nearest transit stops: ${error.message}`);
  }

  return ((data ?? []) as TransitStopRow[])
    .map(mapTransitStop)
    .map((stop) => ({
      ...stop,
      distanceMeters: calculateDistanceMeters(input.coordinates, {
        latitude: stop.latitude,
        longitude: stop.longitude
      })
    }))
    .sort(
      (left, right) =>
        left.distanceMeters - right.distanceMeters ||
        left.stopName.localeCompare(right.stopName) ||
        left.stopId.localeCompare(right.stopId)
    )
    .slice(0, input.limit);
};

export const listTransitEdgesBySourceStopIds = async (
  sourceStopIds: string[]
): Promise<TransitStopEdge[]> => {
  if (sourceStopIds.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("transit_stop_edges")
    .select("*")
    .in("source_stop_id", [...new Set(sourceStopIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch transit edges: ${error.message}`);
  }

  return ((data ?? []) as TransitStopEdgeRow[])
    .map(mapTransitEdge)
    .sort(
      (left, right) =>
        left.sourceStopId.localeCompare(right.sourceStopId) ||
        left.weight - right.weight ||
        left.targetStopId.localeCompare(right.targetStopId)
    );
};

export const getTransitGraphCoverage = async (): Promise<TransitGraphCoverage> => {
  const client = getSupabaseAdminClient();
  const [stopCountResult, edgeCountResult] = await Promise.all([
    client.from("transit_stops").select("stop_id", { count: "exact", head: true }),
    client.from("transit_stop_edges").select("source_stop_id", { count: "exact", head: true })
  ]);

  if (stopCountResult.error) {
    throw new HttpError(500, `Failed to count transit stops: ${stopCountResult.error.message}`);
  }

  if (edgeCountResult.error) {
    throw new HttpError(500, `Failed to count transit stop edges: ${edgeCountResult.error.message}`);
  }

  return {
    stopCount: stopCountResult.count ?? 0,
    edgeCount: edgeCountResult.count ?? 0
  };
};
