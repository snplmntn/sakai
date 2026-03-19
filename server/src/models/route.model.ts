import { getSupabaseAdminClient } from "../config/supabase.js";
import { getStopsByIds } from "./stop.model.js";
import { HttpError } from "../types/http-error.js";
import {
  mapRouteSummary,
  mapRouteVariantBase,
  type RouteLeg,
  type RouteSummary,
  type RouteVariant
} from "../types/route-network.js";
import type { Database } from "../types/database.js";

type RouteRow = Database["public"]["Tables"]["routes"]["Row"];
type RouteVariantRow = Database["public"]["Tables"]["route_variants"]["Row"];
type RouteLegRow = Database["public"]["Tables"]["route_legs"]["Row"];

export interface ListActiveRouteVariantsOptions {
  variantIds?: string[];
  routeIds?: string[];
  originPlaceId?: string;
  destinationPlaceId?: string;
}

const sortRouteSummaries = (routes: RouteSummary[]) =>
  [...routes].sort(
    (left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id)
  );

const sortRouteLegRows = (legs: RouteLegRow[]) =>
  [...legs].sort(
    (left, right) =>
      left.route_variant_id.localeCompare(right.route_variant_id) ||
      left.sequence - right.sequence ||
      left.id.localeCompare(right.id)
  );

const getMissingStopError = (routeLegId: string, stopId: string) =>
  new HttpError(500, `Route leg ${routeLegId} references missing stop ${stopId}`);

const getActiveRouteRowsByIds = async (routeIds: string[]): Promise<RouteRow[]> => {
  if (routeIds.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("routes")
    .select("*")
    .in("id", [...new Set(routeIds)])
    .eq("is_active", true);

  if (error) {
    throw new HttpError(500, `Failed to fetch routes: ${error.message}`);
  }

  return (data ?? []) as RouteRow[];
};

const getActiveRouteVariantRows = async (
  options: ListActiveRouteVariantsOptions
): Promise<RouteVariantRow[]> => {
  if (options.variantIds && options.variantIds.length === 0) {
    return [];
  }

  if (options.routeIds && options.routeIds.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  let query = client.from("route_variants").select("*").eq("is_active", true);

  if (options.variantIds && options.variantIds.length > 0) {
    query = query.in("id", [...new Set(options.variantIds)]);
  }

  if (options.routeIds && options.routeIds.length > 0) {
    query = query.in("route_id", [...new Set(options.routeIds)]);
  }

  if (options.originPlaceId) {
    query = query.eq("origin_place_id", options.originPlaceId);
  }

  if (options.destinationPlaceId) {
    query = query.eq("destination_place_id", options.destinationPlaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new HttpError(500, `Failed to fetch route variants: ${error.message}`);
  }

  return ((data ?? []) as RouteVariantRow[]).sort(
    (left, right) => left.display_name.localeCompare(right.display_name) || left.id.localeCompare(right.id)
  );
};

const getRouteLegRowsByVariantIds = async (variantIds: string[]): Promise<RouteLegRow[]> => {
  if (variantIds.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("route_legs")
    .select("*")
    .in("route_variant_id", [...new Set(variantIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch route legs: ${error.message}`);
  }

  return sortRouteLegRows((data ?? []) as RouteLegRow[]);
};

export const getRouteMetadataByVariantIds = async (
  variantIds: string[]
): Promise<RouteSummary[]> => {
  const variantRows = await getActiveRouteVariantRows({
    variantIds
  });
  const routeRows = await getActiveRouteRowsByIds(variantRows.map((row) => row.route_id));

  return sortRouteSummaries(routeRows.map(mapRouteSummary));
};

export const listActiveRouteVariants = async (
  options: ListActiveRouteVariantsOptions = {}
): Promise<RouteVariant[]> => {
  const variantRows = await getActiveRouteVariantRows(options);

  if (variantRows.length === 0) {
    return [];
  }

  const routeRows = await getActiveRouteRowsByIds(variantRows.map((row) => row.route_id));
  const routeMap = new Map(routeRows.map((row) => [row.id, mapRouteSummary(row)]));
  const legRows = await getRouteLegRowsByVariantIds(variantRows.map((row) => row.id));
  const stops = await getStopsByIds(
    legRows.flatMap((row) => [row.from_stop_id, row.to_stop_id])
  );
  const stopMap = new Map(stops.map((stop) => [stop.id, stop]));
  const legsByVariantId = new Map<string, RouteLeg[]>();

  for (const legRow of legRows) {
    const fromStop = stopMap.get(legRow.from_stop_id);
    const toStop = stopMap.get(legRow.to_stop_id);

    if (!fromStop) {
      throw getMissingStopError(legRow.id, legRow.from_stop_id);
    }

    if (!toStop) {
      throw getMissingStopError(legRow.id, legRow.to_stop_id);
    }

    const routeLeg: RouteLeg = {
      id: legRow.id,
      routeVariantId: legRow.route_variant_id,
      sequence: legRow.sequence,
      mode: legRow.mode,
      fromStop,
      toStop,
      routeLabel: legRow.route_label,
      distanceKm: legRow.distance_km,
      durationMinutes: legRow.duration_minutes,
      fareProductCode: legRow.fare_product_code,
      corridorTag: legRow.corridor_tag,
      createdAt: legRow.created_at
    };
    const existingLegs = legsByVariantId.get(legRow.route_variant_id) ?? [];

    existingLegs.push(routeLeg);
    legsByVariantId.set(legRow.route_variant_id, existingLegs);
  }

  return variantRows.flatMap((variantRow) => {
    const route = routeMap.get(variantRow.route_id);

    if (!route) {
      return [];
    }

    return [
      {
        ...mapRouteVariantBase(variantRow),
        route,
        legs: (legsByVariantId.get(variantRow.id) ?? []).sort(
          (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)
        )
      }
    ];
  });
};
