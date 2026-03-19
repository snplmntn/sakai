import type { PlaceMatch, RideMode, Stop } from "./route-network.js";
import type { FareBreakdown, FareConfidence, PassengerType } from "./fare.js";
import type { RoutePreference } from "../models/user-preference.model.js";

export type RouteQueryValueSource =
  | "request_override"
  | "ai_parsed"
  | "saved_preference"
  | "default";

export interface RouteQueryPointInput {
  placeId?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
}

export interface RouteQueryNormalizedPoint {
  placeId: string;
  label: string;
  matchedBy: PlaceMatch["matchedBy"];
}

export interface RouteQueryNormalizedInput {
  origin: RouteQueryNormalizedPoint;
  destination: RouteQueryNormalizedPoint;
  preference: RoutePreference;
  passengerType: PassengerType;
  preferenceSource: RouteQueryValueSource;
  passengerTypeSource: RouteQueryValueSource;
}

export interface RouteQueryRideLeg {
  type: "ride";
  id: string;
  mode: RideMode;
  routeId: string;
  routeVariantId: string;
  routeCode: string;
  routeName: string;
  directionLabel: string;
  fromStop: Stop;
  toStop: Stop;
  routeLabel: string;
  distanceKm: number;
  durationMinutes: number;
  corridorTags: string[];
  fare: FareBreakdown;
}

export interface RouteQueryWalkLeg {
  type: "walk";
  id: string;
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  durationMinutes: number;
  fare: FareBreakdown;
}

export type RouteQueryLeg = RouteQueryRideLeg | RouteQueryWalkLeg;

export interface RouteQueryOption {
  id: string;
  summary: string;
  recommendationLabel: string;
  highlights: string[];
  totalDurationMinutes: number;
  totalFare: number;
  fareConfidence: FareConfidence;
  transferCount: number;
  corridorTags: string[];
  fareAssumptions: string[];
  legs: RouteQueryLeg[];
  relevantIncidents: [];
}

export interface RouteQueryResult {
  normalizedQuery: RouteQueryNormalizedInput;
  options: RouteQueryOption[];
  message?: string;
}
