import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import {
  mapPlace,
  type Place,
  type PlaceMatch,
  type PlaceResolutionResult
} from "../types/route-network.js";
import * as transitGraphModel from "./transit-graph.model.js";
import type { Database } from "../types/database.js";

type PlaceRow = Database["public"]["Tables"]["places"]["Row"];
type PlaceAliasRow = Database["public"]["Tables"]["place_aliases"]["Row"];
const fallbackWarningKeys = new Set<string>();

const warnOnce = (key: string, message: string, details: Record<string, unknown>) => {
  if (fallbackWarningKeys.has(key)) {
    return;
  }

  fallbackWarningKeys.add(key);
  console.warn(message, details);
};

export interface ResolvePlaceReferenceOptions {
  placeId?: string;
  googlePlaceId?: string;
  query?: string;
}

export const normalizePlaceSearchText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");

const buildCanonicalNameSearchPattern = (normalizedQuery: string) =>
  `%${normalizedQuery.split(" ").filter(Boolean).join("%")}%`;

const sortPlaceMatches = (matches: PlaceMatch[]) =>
  [...matches].sort(
    (left, right) =>
      left.canonicalName.localeCompare(right.canonicalName) || left.id.localeCompare(right.id)
  );

const mapPlaceMatch = (
  row: PlaceRow,
  matchedBy: PlaceMatch["matchedBy"],
  matchedText: string
): PlaceMatch => ({
  ...mapPlace(row),
  matchedBy,
  matchedText
});

const dedupePlaceMatches = (matches: PlaceMatch[]) => {
  const matchMap = new Map<string, PlaceMatch>();

  for (const match of matches) {
    if (!matchMap.has(match.id)) {
      matchMap.set(match.id, match);
    }
  }

  return sortPlaceMatches([...matchMap.values()]);
};

const dedupeMergedMatches = (matches: PlaceMatch[]) => {
  const matchMap = new Map<string, PlaceMatch>();

  for (const match of matches) {
    const key = `${normalizePlaceSearchText(match.canonicalName)}::${normalizePlaceSearchText(match.city)}`;

    if (!matchMap.has(key)) {
      matchMap.set(key, match);
    }
  }

  return sortPlaceMatches([...matchMap.values()]);
};

export const getPlaceById = async (placeId: string): Promise<Place | null> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("places")
    .select("*")
    .eq("id", placeId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to fetch place: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapPlace(data as PlaceRow);
};

export const getPlaceByGooglePlaceId = async (
  googlePlaceId: string
): Promise<Place | null> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("places")
    .select("*")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to fetch place by google place id: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapPlace(data as PlaceRow);
};

const listPlaceMatchesByNormalizedAlias = async (
  normalizedQuery: string
): Promise<PlaceMatch[]> => {
  const client = getSupabaseAdminClient();
  const { data: aliasData, error: aliasError } = await client
    .from("place_aliases")
    .select("*")
    .eq("normalized_alias", normalizedQuery);

  if (aliasError) {
    throw new HttpError(500, `Failed to fetch place aliases: ${aliasError.message}`);
  }

  const aliasRows = (aliasData ?? []) as PlaceAliasRow[];

  if (aliasRows.length === 0) {
    return [];
  }

  const uniquePlaceIds = [...new Set(aliasRows.map((row) => row.place_id))];
  const { data: placeData, error: placeError } = await client
    .from("places")
    .select("*")
    .in("id", uniquePlaceIds);

  if (placeError) {
    throw new HttpError(500, `Failed to fetch places for aliases: ${placeError.message}`);
  }

  const aliasByPlaceId = new Map(aliasRows.map((row) => [row.place_id, row.alias]));
  const placeRows = (placeData ?? []) as PlaceRow[];

  return sortPlaceMatches(
    placeRows.map((row) => mapPlaceMatch(row, "alias", aliasByPlaceId.get(row.id) ?? row.canonical_name))
  );
};

const listPlaceMatchesByCanonicalName = async (
  normalizedQuery: string
): Promise<PlaceMatch[]> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("places")
    .select("*")
    .ilike("canonical_name", buildCanonicalNameSearchPattern(normalizedQuery))
    .limit(25);

  if (error) {
    throw new HttpError(500, `Failed to search places: ${error.message}`);
  }

  const exactMatches = ((data ?? []) as PlaceRow[])
    .filter((row) => normalizePlaceSearchText(row.canonical_name) === normalizedQuery)
    .map((row) => mapPlaceMatch(row, "canonicalName", row.canonical_name));

  return sortPlaceMatches(exactMatches);
};

const listSearchMatchesByNormalizedAlias = async (
  normalizedQuery: string,
  limit: number
): Promise<PlaceMatch[]> => {
  const client = getSupabaseAdminClient();
  const { data: aliasData, error: aliasError } = await client
    .from("place_aliases")
    .select("*")
    .ilike("normalized_alias", `${normalizedQuery}%`)
    .limit(limit);

  if (aliasError) {
    throw new HttpError(500, `Failed to search place aliases: ${aliasError.message}`);
  }

  const aliasRows = (aliasData ?? []) as PlaceAliasRow[];

  if (aliasRows.length === 0) {
    return [];
  }

  const uniquePlaceIds = [...new Set(aliasRows.map((row) => row.place_id))];
  const { data: placeData, error: placeError } = await client
    .from("places")
    .select("*")
    .in("id", uniquePlaceIds);

  if (placeError) {
    throw new HttpError(500, `Failed to fetch places for search aliases: ${placeError.message}`);
  }

  const aliasByPlaceId = new Map(aliasRows.map((row) => [row.place_id, row.alias]));
  const placeRows = (placeData ?? []) as PlaceRow[];

  return dedupePlaceMatches(
    placeRows.map((row) => mapPlaceMatch(row, "alias", aliasByPlaceId.get(row.id) ?? row.canonical_name))
  );
};

const listSearchMatchesByCanonicalName = async (
  normalizedQuery: string,
  limit: number
): Promise<PlaceMatch[]> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("places")
    .select("*")
    .ilike("canonical_name", buildCanonicalNameSearchPattern(normalizedQuery))
    .limit(limit);

  if (error) {
    throw new HttpError(500, `Failed to search places by canonical name: ${error.message}`);
  }

  return dedupePlaceMatches(
    ((data ?? []) as PlaceRow[]).map((row) => mapPlaceMatch(row, "canonicalName", row.canonical_name))
  );
};

export const searchPlaces = async (
  query: string,
  options: {
    limit?: number;
  } = {}
): Promise<PlaceMatch[]> => {
  const normalizedQuery = normalizePlaceSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const [aliasMatches, canonicalMatches, transitMatches] = await Promise.all([
    listSearchMatchesByNormalizedAlias(normalizedQuery, limit),
    listSearchMatchesByCanonicalName(normalizedQuery, limit),
    transitGraphModel
      .searchTransitStopClusters(query, {
        limit
      })
      .catch((error) => {
        warnOnce("place_search_transit_fallback", "Transit-backed place search unavailable; falling back to legacy place search", {
          operation: "place_search_transit_fallback",
          reason: error instanceof Error ? error.message : "unknown error"
        });
        return [];
      })
  ]);

  return dedupeMergedMatches([...transitMatches, ...aliasMatches, ...canonicalMatches]).slice(0, limit);
};

export const resolvePlaceReference = async (
  options: ResolvePlaceReferenceOptions
): Promise<PlaceResolutionResult> => {
  if (options.placeId?.startsWith("cluster:")) {
    const clusterResult = await transitGraphModel
      .resolveTransitStopCluster({
        clusterId: options.placeId
      })
      .catch((error) => {
        warnOnce("place_resolution_transit_fallback", "Transit-backed place resolution unavailable; falling back to legacy places", {
          operation: "place_resolution_transit_fallback",
          reason: error instanceof Error ? error.message : "unknown error"
        });

        return {
          status: "unresolved" as const
        };
      });

    if (clusterResult.status === "resolved") {
      return {
        status: "resolved",
        place: {
          ...clusterResult.cluster,
          matchedBy: "placeId",
          matchedText: options.placeId
        }
      };
    }

    if (clusterResult.status === "ambiguous") {
      return {
        status: "ambiguous",
        matches: clusterResult.matches
      };
    }

    return {
      status: "unresolved"
    };
  }

  if (options.placeId) {
    const place = await getPlaceById(options.placeId);

    if (!place) {
      return {
        status: "unresolved"
      };
    }

    return {
      status: "resolved",
      place: {
        ...place,
        matchedBy: "placeId",
        matchedText: place.id
      }
    };
  }

  if (options.googlePlaceId) {
    const place = await getPlaceByGooglePlaceId(options.googlePlaceId);

    if (place) {
      return {
        status: "resolved",
        place: {
          ...place,
          matchedBy: "googlePlaceId",
          matchedText: options.googlePlaceId
        }
      };
    }
  }

  const normalizedQuery = options.query ? normalizePlaceSearchText(options.query) : "";

  if (!normalizedQuery) {
    return {
      status: "unresolved"
    };
  }

  try {
    const transitResolution = await transitGraphModel.resolveTransitStopCluster({
      query: options.query
    });

    if (transitResolution.status === "resolved") {
      return {
        status: "resolved",
        place: transitResolution.cluster
      };
    }

    if (transitResolution.status === "ambiguous") {
      return {
        status: "ambiguous",
        matches: transitResolution.matches
      };
    }
  } catch (error) {
    warnOnce("place_resolution_transit_fallback", "Transit-backed place resolution unavailable; falling back to legacy places", {
      operation: "place_resolution_transit_fallback",
      reason: error instanceof Error ? error.message : "unknown error"
    });
  }

  const aliasMatches = await listPlaceMatchesByNormalizedAlias(normalizedQuery);

  if (aliasMatches.length === 1) {
    return {
      status: "resolved",
      place: aliasMatches[0]
    };
  }

  if (aliasMatches.length > 1) {
    return {
      status: "ambiguous",
      matches: aliasMatches
    };
  }

  const canonicalMatches = await listPlaceMatchesByCanonicalName(normalizedQuery);

  if (canonicalMatches.length === 1) {
    return {
      status: "resolved",
      place: canonicalMatches[0]
    };
  }

  if (canonicalMatches.length > 1) {
    return {
      status: "ambiguous",
      matches: canonicalMatches
    };
  }

  return {
    status: "unresolved"
  };
};
