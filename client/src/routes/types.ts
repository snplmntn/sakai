import type { PlaceMatchSource } from '../places/types';

export type RoutePreference = 'fastest' | 'cheapest' | 'balanced';
export type PassengerType = 'regular' | 'student' | 'senior' | 'pwd';
export type RideMode = 'jeepney' | 'uv' | 'mrt3' | 'lrt1' | 'lrt2';
export type FareConfidence = 'official' | 'estimated' | 'partially_estimated';

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

export interface RouteQueryRideLeg {
  type: 'ride';
  id: string;
  mode: RideMode;
  routeId: string;
  routeVariantId: string;
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
}

export interface RouteQueryWalkLeg {
  type: 'walk';
  id: string;
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  durationMinutes: number;
  fare: FareBreakdown;
}

export type RouteQueryLeg = RouteQueryRideLeg | RouteQueryWalkLeg;

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
}

export interface RouteQueryResult {
  normalizedQuery: {
    origin: {
      placeId: string;
      label: string;
      matchedBy: PlaceMatchSource;
    };
    destination: {
      placeId: string;
      label: string;
      matchedBy: PlaceMatchSource;
    };
    preference: RoutePreference;
    passengerType: PassengerType;
    preferenceSource: string;
    passengerTypeSource: string;
  };
  options: RouteQueryOption[];
  message?: string;
}
