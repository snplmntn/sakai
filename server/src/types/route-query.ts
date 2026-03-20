import type { PlaceMatch, RideMode, Stop } from "./route-network.js";
import type { FareBreakdown, FareConfidence, PassengerType } from "./fare.js";
import type { RoutePreference } from "../models/user-preference.model.js";

export type RouteQueryValueSource =
  | "request_override"
  | "ai_parsed"
  | "saved_preference"
  | "default";

export type RouteModifier = "jeep_if_possible" | "less_walking";

export interface RouteQueryPointInput {
  placeId?: string;
  googlePlaceId?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
}

export interface RouteQueryNormalizedPoint {
  placeId: string;
  label: string;
  matchedBy: PlaceMatch["matchedBy"];
  latitude: number;
  longitude: number;
}

export interface RouteNavigationTarget {
  latitude: number;
  longitude: number;
  label: string;
  kind: "destination" | "dropoff_stop";
}

export interface RouteQueryNormalizedInput {
  origin: RouteQueryNormalizedPoint;
  destination: RouteQueryNormalizedPoint;
  preference: RoutePreference;
  passengerType: PassengerType;
  preferenceSource: RouteQueryValueSource;
  passengerTypeSource: RouteQueryValueSource;
  modifiers: RouteModifier[];
  modifierSource: RouteQueryValueSource;
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

export interface RouteQueryDriveLeg {
  type: "drive";
  id: string;
  mode: "car";
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  durationMinutes: number;
  fare: FareBreakdown;
}

export type RouteQueryLeg = RouteQueryRideLeg | RouteQueryWalkLeg | RouteQueryDriveLeg;

export interface RouteQueryIncident {
  id: string;
  alertType: string;
  location: string;
  direction: string | null;
  severity: "low" | "medium" | "high";
  summary: string;
  displayUntil: string;
  scrapedAt: string;
  sourceUrl: string;
}

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
  relevantIncidents: RouteQueryIncident[];
  navigationTarget: RouteNavigationTarget;
}

export interface RouteQueryResult {
  normalizedQuery: RouteQueryNormalizedInput;
  options: RouteQueryOption[];
  message?: string;
}
