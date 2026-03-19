import type { Database } from "./database.js";

type PlaceRow = Database["public"]["Tables"]["places"]["Row"];
type PlaceAliasRow = Database["public"]["Tables"]["place_aliases"]["Row"];
type StopRow = Database["public"]["Tables"]["stops"]["Row"];
type RouteRow = Database["public"]["Tables"]["routes"]["Row"];
type RouteVariantRow = Database["public"]["Tables"]["route_variants"]["Row"];
type RouteLegRow = Database["public"]["Tables"]["route_legs"]["Row"];
type TransferPointRow = Database["public"]["Tables"]["transfer_points"]["Row"];

export type PlaceKind = PlaceRow["kind"];
export type RideMode = RouteRow["primary_mode"];
export type StopMode = StopRow["mode"];
export type RouteTrustLevel = RouteRow["trust_level"];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  canonicalName: string;
  city: string;
  kind: PlaceKind;
  latitude: number;
  longitude: number;
  googlePlaceId: string | null;
  createdAt: string;
}

export interface PlaceAlias {
  id: string;
  placeId: string;
  alias: string;
  normalizedAlias: string;
}

export type PlaceMatchSource = "placeId" | "alias" | "canonicalName";

export interface PlaceMatch extends Place {
  matchedBy: PlaceMatchSource;
  matchedText: string;
}

export type PlaceResolutionResult =
  | {
      status: "resolved";
      place: PlaceMatch;
    }
  | {
      status: "unresolved";
    }
  | {
      status: "ambiguous";
      matches: PlaceMatch[];
    };

export interface Stop {
  id: string;
  placeId: string | null;
  stopName: string;
  mode: StopMode;
  area: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  createdAt: string;
}

export interface NearbyStop extends Stop {
  distanceMeters: number;
}

export interface RouteSummary {
  id: string;
  code: string;
  displayName: string;
  primaryMode: RideMode;
  operatorName: string | null;
  sourceName: string;
  sourceUrl: string | null;
  trustLevel: RouteTrustLevel;
  isActive: boolean;
  createdAt: string;
}

export interface RouteLeg {
  id: string;
  routeVariantId: string;
  sequence: number;
  mode: RouteLegRow["mode"];
  fromStop: Stop;
  toStop: Stop;
  routeLabel: string;
  distanceKm: number;
  durationMinutes: number;
  fareProductCode: string | null;
  corridorTag: string;
  createdAt: string;
}

export interface RouteVariant {
  id: string;
  routeId: string;
  displayName: string;
  directionLabel: string;
  originPlaceId: string | null;
  destinationPlaceId: string | null;
  isActive: boolean;
  createdAt: string;
  route: RouteSummary;
  legs: RouteLeg[];
}

export interface TransferPoint {
  id: string;
  fromStopId: string;
  toStopId: string;
  walkingDistanceM: number;
  walkingDurationMinutes: number;
  isAccessible: boolean;
  createdAt: string;
}

export const mapPlace = (row: PlaceRow): Place => ({
  id: row.id,
  canonicalName: row.canonical_name,
  city: row.city,
  kind: row.kind,
  latitude: row.latitude,
  longitude: row.longitude,
  googlePlaceId: row.google_place_id,
  createdAt: row.created_at
});

export const mapPlaceAlias = (row: PlaceAliasRow): PlaceAlias => ({
  id: row.id,
  placeId: row.place_id,
  alias: row.alias,
  normalizedAlias: row.normalized_alias
});

export const mapStop = (row: StopRow): Stop => ({
  id: row.id,
  placeId: row.place_id,
  stopName: row.stop_name,
  mode: row.mode,
  area: row.area,
  latitude: row.latitude,
  longitude: row.longitude,
  isActive: row.is_active,
  createdAt: row.created_at
});

export const mapRouteSummary = (row: RouteRow): RouteSummary => ({
  id: row.id,
  code: row.code,
  displayName: row.display_name,
  primaryMode: row.primary_mode,
  operatorName: row.operator_name,
  sourceName: row.source_name,
  sourceUrl: row.source_url,
  trustLevel: row.trust_level,
  isActive: row.is_active,
  createdAt: row.created_at
});

export const mapTransferPoint = (row: TransferPointRow): TransferPoint => ({
  id: row.id,
  fromStopId: row.from_stop_id,
  toStopId: row.to_stop_id,
  walkingDistanceM: row.walking_distance_m,
  walkingDurationMinutes: row.walking_duration_minutes,
  isAccessible: row.is_accessible,
  createdAt: row.created_at
});

export const mapRouteVariantBase = (row: RouteVariantRow) => ({
  id: row.id,
  routeId: row.route_id,
  displayName: row.display_name,
  directionLabel: row.direction_label,
  originPlaceId: row.origin_place_id,
  destinationPlaceId: row.destination_place_id,
  isActive: row.is_active,
  createdAt: row.created_at
});
