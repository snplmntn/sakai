export type AlarmMode = 'sound' | 'vibration' | 'both';

export type AlertRadiusMeters = 150 | 300 | 500;

export interface NavigationTarget {
  latitude: number;
  longitude: number;
  label: string;
}

export interface ActiveNavigationSession {
  routeId: string;
  routeLabel: string;
  destination: NavigationTarget;
  alertRadiusMeters: AlertRadiusMeters;
  alarmMode: AlarmMode;
  nearDestinationEnabled: boolean;
  startedAt: string;
}

