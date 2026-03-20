import type { RouteQueryIncident } from '../routes/types';

export type AlarmMode = 'sound' | 'vibration' | 'both';

export type AlertRadiusMeters = 150 | 300 | 500;

export interface NavigationTarget {
  latitude: number;
  longitude: number;
  label: string;
}

export interface NavigationRouteCandidate {
  routeId: string;
  routeLabel: string;
  summary: string;
  durationLabel: string;
  fareLabel: string;
  originLabel: string;
  destinationLabel: string;
  corridorTags: string[];
  relevantIncidents: RouteQueryIncident[];
  destination: NavigationTarget;
}

export interface ActiveNavigationSession {
  routeId: string;
  routeLabel: string;
  summary: string;
  durationLabel: string;
  fareLabel: string;
  originLabel: string;
  destinationLabel: string;
  corridorTags: string[];
  relevantIncidents: RouteQueryIncident[];
  destination: NavigationTarget;
  alertRadiusMeters: AlertRadiusMeters;
  alarmMode: AlarmMode;
  nearDestinationEnabled: boolean;
  startedAt: string;
}
