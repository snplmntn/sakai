import type { PlaceMatchSource } from '../places/types';

export type RoutePreference = 'fastest' | 'cheapest' | 'balanced';
export type PassengerType = 'regular' | 'student' | 'senior' | 'pwd';
export type RouteModifier = 'jeep_if_possible' | 'less_walking';
export type CommuteMode = 'jeepney' | 'train' | 'uv' | 'bus' | 'tricycle';
export type RideMode = 'jeepney' | 'uv' | 'mrt3' | 'lrt1' | 'lrt2' | 'tricycle' | 'car' | 'bus' | 'rail';
export type FareConfidence = 'official' | 'estimated' | 'partially_estimated';
export type RouteLifecycleStatus = 'active' | 'deprecated' | 'superseded';
export type RouteTrustLevel = 'trusted_seed' | 'community_reviewed' | 'demo_fallback';

export interface RouteQueryPointInput {
  placeId?: string;
  googlePlaceId?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
}

export interface RouteStop {
  id: string;
  placeId: string | null;
  externalStopCode: string | null;
  stopName: string;
  mode: RideMode | 'walk_anchor';
  area: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  createdAt: string;
}

export interface FareBreakdown {
  amount: number;
  pricingType: string;
  fareProductCode: string | null;
  ruleVersionName: string | null;
  effectivityDate: string | null;
  isDiscountApplied: boolean;
  assumptionText: string | null;
}

export interface RouteCommunityUpdate {
  id: string;
  action:
    | 'route_create'
    | 'route_update'
    | 'route_deprecate'
    | 'route_reactivate'
    | 'stop_correction'
    | 'transfer_correction'
    | 'fare_update'
    | 'route_note';
  summary: string;
  publishedAt: string;
}

export interface RouteCommunityNote {
  id: string;
  note: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface RouteCommunityMetadata {
  routeId: string | null;
  routeVariantId: string | null;
  routeVariantCode: string | null;
  routeCode: string;
  routeName: string;
  lifecycleStatus: RouteLifecycleStatus;
  trustLevel: RouteTrustLevel;
  recentUpdates: RouteCommunityUpdate[];
  activeNotes: RouteCommunityNote[];
}

export interface RouteQueryRideLeg {
  type: 'ride';
  id: string;
  mode: RideMode;
  routeId: string;
  routeVariantId: string;
  routeVariantCode: string | null;
  routeCode: string;
  routeName: string;
  directionLabel: string;
  fromStop: RouteStop;
  toStop: RouteStop;
  routeLabel: string;
  distanceKm: number;
  durationMinutes: number;
  corridorTags: string[];
  fare: FareBreakdown;
  community?: RouteCommunityMetadata;
  pathCoordinates?: Array<{
    latitude: number;
    longitude: number;
  }>;
}

export interface RouteQueryWalkLeg {
  type: 'walk';
  id: string;
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  durationMinutes: number;
  fare: FareBreakdown;
  pathCoordinates?: Array<{
    latitude: number;
    longitude: number;
  }>;
}

export interface RouteQueryDriveLeg {
  type: 'drive';
  id: string;
  mode: 'car';
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  durationMinutes: number;
  fare: FareBreakdown;
  pathCoordinates?: Array<{
    latitude: number;
    longitude: number;
  }>;
}

export type RouteQueryLeg = RouteQueryRideLeg | RouteQueryWalkLeg | RouteQueryDriveLeg;

export interface RouteQueryIncident {
  id: string;
  alertType: string;
  location: string;
  direction: string | null;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  displayUntil: string;
  scrapedAt: string;
  sourceUrl: string;
}

export interface RouteNavigationTarget {
  latitude: number;
  longitude: number;
  label: string;
  kind: 'destination' | 'dropoff_stop';
}

export interface RouteQueryOption {
  id: string;
  summary: string;
  recommendationLabel: string;
  highlights: string[];
  totalDurationMinutes: number;
  totalFare: number | null;
  fareConfidence: FareConfidence;
  transferCount: number;
  corridorTags: string[];
  fareAssumptions: string[];
  legs: RouteQueryLeg[];
  relevantIncidents: RouteQueryIncident[];
  routeCommunity?: RouteCommunityMetadata[];
  navigationTarget: RouteNavigationTarget;
  source: 'sakai' | 'google_fallback';
  providerLabel?: string;
  providerNotice?: string;
}

export interface RouteQueryFallbackResult {
  status: 'available' | 'no_results' | 'unavailable' | 'skipped';
  options: RouteQueryOption[];
  message?: string;
}

export interface RouteQueryResult {
  normalizedQuery: {
    origin: {
      placeId: string;
      label: string;
      matchedBy: PlaceMatchSource;
      latitude: number;
      longitude: number;
    };
    destination: {
      placeId: string;
      label: string;
      matchedBy: PlaceMatchSource;
      latitude: number;
      longitude: number;
    };
    preference: RoutePreference;
    passengerType: PassengerType;
    preferenceSource: string;
    passengerTypeSource: string;
    modifiers: RouteModifier[];
    modifierSource: string;
    commuteModes: CommuteMode[];
    commuteModeSource: string;
    allowCarAccess: boolean;
    carAccessSource: string;
  };
  options: RouteQueryOption[];
  googleFallback: RouteQueryFallbackResult;
  message?: string;
}
