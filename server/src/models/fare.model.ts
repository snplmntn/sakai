import { getSupabaseAdminClient } from "../config/supabase.js";
import { getStopsByIds } from "./stop.model.js";
import { HttpError } from "../types/http-error.js";
import {
  mapFareProduct,
  mapFareRuleVersion,
  mapTrainStationFare,
  type FareLookupKey,
  type FareProduct,
  type FareRuleMode,
  type FareRuleVersion,
  type TrainStationFare
} from "../types/fare.js";
import type { Database } from "../types/database.js";

type FareRuleVersionRow = Database["public"]["Tables"]["fare_rule_versions"]["Row"];
type FareProductRow = Database["public"]["Tables"]["fare_products"]["Row"];
type TrainStationFareRow = Database["public"]["Tables"]["train_station_fares"]["Row"];

const TRAIN_STOP_MODES = new Set(["mrt3", "lrt1", "lrt2"]);

const getPairKey = (originStopId: string, destinationStopId: string) =>
  `${originStopId}:${destinationStopId}`;

export interface FareProductLookupOptions {
  fareRuleVersionIds: string[];
  productCodes: string[];
}

export interface TrainStationFareLookupOptions {
  fareRuleVersionIds: string[];
  stopPairs: FareLookupKey[];
}

export const getActiveFareRuleVersionsByModes = async (
  modes: FareRuleMode[]
): Promise<FareRuleVersion[]> => {
  if (modes.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("fare_rule_versions")
    .select("*")
    .in("mode", [...new Set(modes)])
    .eq("is_active", true);

  if (error) {
    throw new HttpError(500, `Failed to fetch fare rule versions: ${error.message}`);
  }

  return ((data ?? []) as FareRuleVersionRow[])
    .map(mapFareRuleVersion)
    .sort((left, right) => left.mode.localeCompare(right.mode) || left.id.localeCompare(right.id));
};

export const getFareProductsByVersionIdsAndCodes = async (
  options: FareProductLookupOptions
): Promise<FareProduct[]> => {
  if (options.fareRuleVersionIds.length === 0 || options.productCodes.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("fare_products")
    .select("*")
    .in("fare_rule_version_id", [...new Set(options.fareRuleVersionIds)])
    .in("product_code", [...new Set(options.productCodes)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch fare products: ${error.message}`);
  }

  return ((data ?? []) as FareProductRow[])
    .map(mapFareProduct)
    .sort(
      (left, right) =>
        left.productCode.localeCompare(right.productCode) ||
        left.fareRuleVersionId.localeCompare(right.fareRuleVersionId) ||
        left.id.localeCompare(right.id)
    );
};

export const getTrainStationFaresByVersionIdsAndPairs = async (
  options: TrainStationFareLookupOptions
): Promise<TrainStationFare[]> => {
  if (options.fareRuleVersionIds.length === 0 || options.stopPairs.length === 0) {
    return [];
  }

  const uniquePairs = [...new Map(options.stopPairs.map((pair) => [getPairKey(pair.originStopId, pair.destinationStopId), pair])).values()];
  const stopIds = uniquePairs.flatMap((pair) => [pair.originStopId, pair.destinationStopId]);
  const stops = await getStopsByIds(stopIds);
  const stopModeById = new Map(stops.map((stop) => [stop.id, stop.mode]));

  for (const stopId of [...new Set(stopIds)]) {
    const stopMode = stopModeById.get(stopId);

    if (!stopMode) {
      throw new HttpError(500, `Train station fare lookup references missing stop ${stopId}`);
    }

    if (!TRAIN_STOP_MODES.has(stopMode)) {
      throw new HttpError(500, `Train station fare lookup requires train stop modes, received ${stopMode}`);
    }
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("train_station_fares")
    .select("*")
    .in("fare_rule_version_id", [...new Set(options.fareRuleVersionIds)])
    .in(
      "origin_stop_id",
      [...new Set(uniquePairs.map((pair) => pair.originStopId))]
    )
    .in(
      "destination_stop_id",
      [...new Set(uniquePairs.map((pair) => pair.destinationStopId))]
    );

  if (error) {
    throw new HttpError(500, `Failed to fetch train station fares: ${error.message}`);
  }

  const pairKeys = new Set(uniquePairs.map((pair) => getPairKey(pair.originStopId, pair.destinationStopId)));

  return ((data ?? []) as TrainStationFareRow[])
    .map(mapTrainStationFare)
    .filter((fare) => pairKeys.has(getPairKey(fare.originStopId, fare.destinationStopId)))
    .sort(
      (left, right) =>
        left.fareRuleVersionId.localeCompare(right.fareRuleVersionId) ||
        left.originStopId.localeCompare(right.originStopId) ||
        left.destinationStopId.localeCompare(right.destinationStopId) ||
        left.id.localeCompare(right.id)
    );
};
