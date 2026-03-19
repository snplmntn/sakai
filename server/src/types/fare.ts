import type { Database } from "./database.js";
import type { RideMode } from "./route-network.js";

type FareRuleVersionRow = Database["public"]["Tables"]["fare_rule_versions"]["Row"];
type FareProductRow = Database["public"]["Tables"]["fare_products"]["Row"];
type TrainStationFareRow = Database["public"]["Tables"]["train_station_fares"]["Row"];

export type PassengerType =
  Database["public"]["Tables"]["user_preferences"]["Row"]["passenger_type"];
export type FareRuleMode = FareRuleVersionRow["mode"];
export type FareProductMode = FareProductRow["mode"];
export type FarePricingStrategy = FareProductRow["pricing_strategy"];
export type FareRuleVersionTrustLevel = FareRuleVersionRow["trust_level"];
export type FarePricingType = "official" | "estimated" | "community_estimated";
export type FareConfidence = "official" | "estimated" | "partially_estimated";
export type FareResolutionReasonCode =
  | "missing_active_fare_rule_version"
  | "missing_fare_product_code"
  | "missing_fare_product"
  | "missing_train_station_fare";
export type TrainMode = Extract<RideMode, "mrt3" | "lrt1" | "lrt2">;

export interface FareRuleVersion {
  id: string;
  mode: FareRuleMode;
  versionName: string;
  sourceName: string;
  sourceUrl: string;
  effectivityDate: string;
  verifiedAt: string;
  isActive: boolean;
  trustLevel: FareRuleVersionTrustLevel;
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

export interface FareLookupKey {
  originStopId: string;
  destinationStopId: string;
}

export interface RideLegFareSegment {
  kind: "ride_leg";
  id: string;
  mode: RideMode;
  routeLabel: string;
  distanceKm: number;
  fareProductCode: string | null;
  fromStopId: string;
  toStopId: string;
}

export interface TransferWalkFareSegment {
  kind: "transfer_walk";
  id: string;
  description: string;
  walkingDistanceM: number;
  walkingDurationMinutes: number;
}

export interface CarLegFareSegment {
  kind: "car_leg";
  id: string;
  routeLabel: string;
  distanceKm: number;
  fareProductCode: string | null;
}

export type FareSegment =
  | RideLegFareSegment
  | TransferWalkFareSegment
  | CarLegFareSegment;

export interface BasePricedFareSegment {
  segmentId: string;
  segmentKind: FareSegment["kind"];
  amount: number;
  pricingType: FarePricingType;
  fareProductCode: string | null;
  ruleVersionName: string | null;
  effectivityDate: string | null;
  isDiscountApplied: boolean;
  assumptionText: string | null;
  reasonCode: FareResolutionReasonCode | null;
}

export interface FareQuote {
  status: "priced";
  segments: BasePricedFareSegment[];
  totalFare: number;
  fareConfidence: FareConfidence;
  fareAssumptions: string[];
}

export interface UnpriceableFareQuote {
  status: "unpriceable";
  segments: BasePricedFareSegment[];
  totalFare: null;
  fareConfidence: null;
  fareAssumptions: string[];
  unresolvedSegmentId: string;
  reasonCode: FareResolutionReasonCode;
  message: string;
}

export type FareQuoteResult = FareQuote | UnpriceableFareQuote;

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
