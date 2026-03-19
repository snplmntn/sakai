import type { Database } from "./database.js";

type FareRuleVersionRow = Database["public"]["Tables"]["fare_rule_versions"]["Row"];
type FareProductRow = Database["public"]["Tables"]["fare_products"]["Row"];
type TrainStationFareRow = Database["public"]["Tables"]["train_station_fares"]["Row"];

export type FareRuleMode = FareRuleVersionRow["mode"];
export type FareProductMode = FareProductRow["mode"];
export type FarePricingStrategy = FareProductRow["pricing_strategy"];
export type FareRuleTrustLevel = FareRuleVersionRow["trust_level"];
export type PassengerType = Database["public"]["Tables"]["user_preferences"]["Row"]["passenger_type"];
export type PricingType = "official" | "estimated" | "community_estimated";
export type FareConfidence = "official" | "estimated" | "partially_estimated";

export interface FareRuleVersion {
  id: string;
  mode: FareRuleMode;
  versionName: string;
  sourceName: string;
  sourceUrl: string;
  effectivityDate: string;
  verifiedAt: string;
  isActive: boolean;
  trustLevel: FareRuleTrustLevel;
  createdAt: string;
}

export interface FareProduct {
  id: string;
  fareRuleVersionId: string;
  productCode: string;
  mode: FareProductMode;
  pricingStrategy: FarePricingStrategy;
  vehicleClass: string;
  minimumDistanceKm: number;
  minimumFareRegular: number;
  minimumFareDiscounted: number | null;
  succeedingDistanceKm: number;
  succeedingFareRegular: number;
  succeedingFareDiscounted: number | null;
  notes: string | null;
  createdAt: string;
}

export interface TrainStationFare {
  id: string;
  fareRuleVersionId: string;
  originStopId: string;
  destinationStopId: string;
  regularFare: number;
  discountedFare: number;
  createdAt: string;
}

export interface FareBreakdown {
  amount: number;
  pricingType: PricingType;
  fareProductCode: string | null;
  ruleVersionName: string | null;
  effectivityDate: string | null;
  isDiscountApplied: boolean;
  assumptionText: string | null;
}

export const mapFareRuleVersion = (row: FareRuleVersionRow): FareRuleVersion => ({
  id: row.id,
  mode: row.mode,
  versionName: row.version_name,
  sourceName: row.source_name,
  sourceUrl: row.source_url,
  effectivityDate: row.effectivity_date,
  verifiedAt: row.verified_at,
  isActive: row.is_active,
  trustLevel: row.trust_level,
  createdAt: row.created_at
});

export const mapFareProduct = (row: FareProductRow): FareProduct => ({
  id: row.id,
  fareRuleVersionId: row.fare_rule_version_id,
  productCode: row.product_code,
  mode: row.mode,
  pricingStrategy: row.pricing_strategy,
  vehicleClass: row.vehicle_class,
  minimumDistanceKm: row.minimum_distance_km,
  minimumFareRegular: row.minimum_fare_regular,
  minimumFareDiscounted: row.minimum_fare_discounted,
  succeedingDistanceKm: row.succeeding_distance_km,
  succeedingFareRegular: row.succeeding_fare_regular,
  succeedingFareDiscounted: row.succeeding_fare_discounted,
  notes: row.notes,
  createdAt: row.created_at
});

export const mapTrainStationFare = (row: TrainStationFareRow): TrainStationFare => ({
  id: row.id,
  fareRuleVersionId: row.fare_rule_version_id,
  originStopId: row.origin_stop_id,
  destinationStopId: row.destination_stop_id,
  regularFare: row.regular_fare,
  discountedFare: row.discounted_fare,
  createdAt: row.created_at
});
