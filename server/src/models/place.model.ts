import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import {
  mapPlace,
  type Place,
  type PlaceMatch,
  type PlaceResolutionResult
} from "../types/route-network.js";
import type { Database } from "../types/database.js";

type PlaceRow = Database["public"]["Tables"]["places"]["Row"];
type PlaceAliasRow = Database["public"]["Tables"]["place_aliases"]["Row"];

export interface ResolvePlaceReferenceOptions {
  placeId?: string;
  query?: string;
}

const normalizePlaceSearchText = (value: string) =>
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

export const resolvePlaceReference = async (
  options: ResolvePlaceReferenceOptions
): Promise<PlaceResolutionResult> => {
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

  const normalizedQuery = options.query ? normalizePlaceSearchText(options.query) : "";

  if (!normalizedQuery) {
    return {
      status: "unresolved"
    };
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
