import { getSupabaseAdminClient } from "../config/supabase.js";
import { getStopsByIds } from "./stop.model.js";
import { HttpError } from "../types/http-error.js";
import {
  mapFareProduct,
  mapFareRuleVersion,
  mapTrainStationFare,
  type FareProduct,
  type FareRuleMode,
  type FareRuleVersion,
  type TrainStationFare
} from "../types/fare.js";
import type { Database } from "../types/database.js";

type FareRuleVersionRow = Database["public"]["Tables"]["fare_rule_versions"]["Row"];
type FareProductRow = Database["public"]["Tables"]["fare_products"]["Row"];
type TrainStationFareRow = Database["public"]["Tables"]["train_station_fares"]["Row"];

export interface ActiveFareCatalog {
  ruleVersions: FareRuleVersion[];
  fareProducts: FareProduct[];
  trainStationFares: TrainStationFare[];
}

export const getActiveFareRuleVersionsByModes = async (
  modes: FareRuleMode[]
): Promise<FareRuleVersion[]> => {
  if (modes.length === 0) {
    return [];
  }

  const uniqueModes = [...new Set(modes)];
  const client = getSupabaseAdminClient();
  const { data: ruleVersionData, error: ruleVersionError } = await client
    .from("fare_rule_versions")
    .select("*")
    .in("mode", uniqueModes)
    .eq("is_active", true);

  if (ruleVersionError) {
    throw new HttpError(500, `Failed to fetch fare rule versions: ${ruleVersionError.message}`);
  }

  return ((ruleVersionData ?? []) as FareRuleVersionRow[])
    .map(mapFareRuleVersion)
    .sort((left, right) => left.mode.localeCompare(right.mode) || left.id.localeCompare(right.id));
};

export const getFareProductsByVersionIdsAndCodes = async (input: {
  fareRuleVersionIds: string[];
  productCodes: string[];
}): Promise<FareProduct[]> => {
  if (input.fareRuleVersionIds.length === 0 || input.productCodes.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("fare_products")
    .select("*")
    .in("fare_rule_version_id", [...new Set(input.fareRuleVersionIds)])
    .in("product_code", [...new Set(input.productCodes)]);

  if (error) {
    throw new HttpError(
      500,
      `Failed to fetch fare products: ${error.message}`
    );
  }

  return ((data ?? []) as FareProductRow[])
    .map(mapFareProduct)
    .sort(
      (left, right) =>
        left.productCode.localeCompare(right.productCode) || left.id.localeCompare(right.id)
    );
};

export const getTrainStationFaresByVersionIdsAndPairs = async (input: {
  fareRuleVersionIds: string[];
  stopPairs: Array<{
    originStopId: string;
    destinationStopId: string;
  }>;
}): Promise<TrainStationFare[]> => {
  if (input.fareRuleVersionIds.length === 0 || input.stopPairs.length === 0) {
    return [];
  }

  const stopIds = [
    ...new Set(input.stopPairs.flatMap((stopPair) => [stopPair.originStopId, stopPair.destinationStopId]))
  ];
  const stops = await getStopsByIds(stopIds);

  if (
    stops.some(
      (stop) => stop.mode !== "mrt3" && stop.mode !== "lrt1" && stop.mode !== "lrt2"
    )
  ) {
    throw new HttpError(400, "Train station fare lookup requires train stop modes");
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("train_station_fares")
    .select("*")
    .in("fare_rule_version_id", [...new Set(input.fareRuleVersionIds)])
    .in("origin_stop_id", [...new Set(input.stopPairs.map((stopPair) => stopPair.originStopId))])
    .in(
      "destination_stop_id",
      [...new Set(input.stopPairs.map((stopPair) => stopPair.destinationStopId))]
    );

  if (error) {
    throw new HttpError(500, `Failed to fetch train station fares: ${error.message}`);
  }

  return ((data ?? []) as TrainStationFareRow[])
    .map(mapTrainStationFare)
    .sort(
      (left, right) =>
        left.originStopId.localeCompare(right.originStopId) ||
        left.destinationStopId.localeCompare(right.destinationStopId) ||
        left.id.localeCompare(right.id)
    );
};

export const getActiveFareCatalog = async (
  modes: FareRuleMode[]
): Promise<ActiveFareCatalog> => {
  const ruleVersions = await getActiveFareRuleVersionsByModes(modes);

  if (ruleVersions.length === 0) {
    return {
      ruleVersions: [],
      fareProducts: [],
      trainStationFares: []
    };
  }

  const fareRuleVersionIds = ruleVersions.map((ruleVersion) => ruleVersion.id);
  const client = getSupabaseAdminClient();
  const [fareProductsResult, trainStationFaresResult] = await Promise.all([
    client.from("fare_products").select("*").in("fare_rule_version_id", fareRuleVersionIds),
    client.from("train_station_fares").select("*").in("fare_rule_version_id", fareRuleVersionIds)
  ]);

  if (fareProductsResult.error) {
    throw new HttpError(500, `Failed to fetch fare products: ${fareProductsResult.error.message}`);
  }

  if (trainStationFaresResult.error) {
    throw new HttpError(
      500,
      `Failed to fetch train station fares: ${trainStationFaresResult.error.message}`
    );
  }

  return {
    ruleVersions,
    fareProducts: ((fareProductsResult.data ?? []) as FareProductRow[]).map(mapFareProduct),
    trainStationFares: ((trainStationFaresResult.data ?? []) as TrainStationFareRow[]).map(
      mapTrainStationFare
    )
  };
};
