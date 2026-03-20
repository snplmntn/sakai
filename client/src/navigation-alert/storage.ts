import * as SecureStore from 'expo-secure-store';

import { isRecord } from '../api/base';
import type { ActiveNavigationSession, AlarmMode, AlertRadiusMeters, NavigationTarget } from './types';
import type { RouteQueryIncident } from '../routes/types';

const ACTIVE_NAVIGATION_STORAGE_KEY = 'sakai.active.navigation.session';

const isAlarmMode = (value: unknown): value is AlarmMode =>
  value === 'sound' || value === 'vibration' || value === 'both';

const isAlertRadiusMeters = (value: unknown): value is AlertRadiusMeters =>
  value === 150 || value === 300 || value === 500;

const parseNavigationTarget = (value: unknown): NavigationTarget => {
  if (
    !isRecord(value) ||
    typeof value.latitude !== 'number' ||
    typeof value.longitude !== 'number' ||
    typeof value.label !== 'string'
  ) {
    throw new Error('Invalid navigation target');
  }

  return {
    latitude: value.latitude,
    longitude: value.longitude,
    label: value.label,
  };
};

const parseRouteIncident = (value: unknown): RouteQueryIncident => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.alertType !== 'string' ||
    typeof value.location !== 'string' ||
    (value.direction !== null && value.direction !== undefined && typeof value.direction !== 'string') ||
    (value.severity !== 'low' && value.severity !== 'medium' && value.severity !== 'high') ||
    typeof value.summary !== 'string' ||
    typeof value.displayUntil !== 'string' ||
    typeof value.scrapedAt !== 'string' ||
    typeof value.sourceUrl !== 'string'
  ) {
    throw new Error('Invalid route incident');
  }

  return {
    id: value.id,
    alertType: value.alertType,
    location: value.location,
    direction: value.direction ?? null,
    severity: value.severity,
    summary: value.summary,
    displayUntil: value.displayUntil,
    scrapedAt: value.scrapedAt,
    sourceUrl: value.sourceUrl,
  };
};

const parseActiveNavigationSession = (value: unknown): ActiveNavigationSession => {
  if (
    !isRecord(value) ||
    typeof value.routeId !== 'string' ||
    typeof value.routeLabel !== 'string' ||
    !isAlertRadiusMeters(value.alertRadiusMeters) ||
    !isAlarmMode(value.alarmMode) ||
    typeof value.nearDestinationEnabled !== 'boolean' ||
    typeof value.startedAt !== 'string'
  ) {
    throw new Error('Invalid navigation session');
  }

  return {
    routeId: value.routeId,
    routeLabel: value.routeLabel,
    summary: typeof value.summary === 'string' ? value.summary : '',
    durationLabel: typeof value.durationLabel === 'string' ? value.durationLabel : '',
    fareLabel: typeof value.fareLabel === 'string' ? value.fareLabel : '',
    originLabel: typeof value.originLabel === 'string' ? value.originLabel : '',
    destinationLabel:
      typeof value.destinationLabel === 'string'
        ? value.destinationLabel
        : parseNavigationTarget(value.destination).label,
    corridorTags: Array.isArray(value.corridorTags)
      ? value.corridorTags.filter((item): item is string => typeof item === 'string')
      : [],
    relevantIncidents: Array.isArray(value.relevantIncidents)
      ? value.relevantIncidents.map(parseRouteIncident)
      : [],
    destination: parseNavigationTarget(value.destination),
    alertRadiusMeters: value.alertRadiusMeters,
    alarmMode: value.alarmMode,
    nearDestinationEnabled: value.nearDestinationEnabled,
    startedAt: value.startedAt,
  };
};

export const readActiveNavigationSession = async (): Promise<ActiveNavigationSession | null> => {
  const storedValue = await SecureStore.getItemAsync(ACTIVE_NAVIGATION_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return parseActiveNavigationSession(JSON.parse(storedValue) as unknown);
  } catch {
    await SecureStore.deleteItemAsync(ACTIVE_NAVIGATION_STORAGE_KEY);
    return null;
  }
};

export const writeActiveNavigationSession = async (
  session: ActiveNavigationSession
): Promise<void> => {
  await SecureStore.setItemAsync(
    ACTIVE_NAVIGATION_STORAGE_KEY,
    JSON.stringify(session)
  );
};

export const clearActiveNavigationSession = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ACTIVE_NAVIGATION_STORAGE_KEY);
};

