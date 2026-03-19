import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import {
  clearActiveNavigationSession,
  readActiveNavigationSession,
} from './storage';
import { calculateDistanceMeters } from './utils';
import { scheduleArrivalNotification } from './notification-service';

export const NEAR_DESTINATION_LOCATION_TASK = 'sakai.near-destination-location-task';
export const NEAR_DESTINATION_SOUND_CHANNEL = 'near-destination-sound';
export const NEAR_DESTINATION_VIBRATION_CHANNEL = 'near-destination-vibration';
export const NEAR_DESTINATION_BOTH_CHANNEL = 'near-destination-both';
export const getChannelIdForAlarmMode = (alarmMode: 'sound' | 'vibration' | 'both'): string => {
  if (alarmMode === 'sound') {
    return NEAR_DESTINATION_SOUND_CHANNEL;
  }

  if (alarmMode === 'vibration') {
    return NEAR_DESTINATION_VIBRATION_CHANNEL;
  }

  return NEAR_DESTINATION_BOTH_CHANNEL;
};


const readLatestLocation = (value: unknown): { latitude: number; longitude: number } | null => {
  if (!value || typeof value !== 'object' || !('locations' in value)) {
    return null;
  }

  const locations = value.locations;

  if (!Array.isArray(locations) || locations.length === 0) {
    return null;
  }

  const latestLocation = locations[locations.length - 1];

  if (
    !latestLocation ||
    typeof latestLocation !== 'object' ||
    !('coords' in latestLocation) ||
    !latestLocation.coords ||
    typeof latestLocation.coords !== 'object' ||
    typeof latestLocation.coords.latitude !== 'number' ||
    typeof latestLocation.coords.longitude !== 'number'
  ) {
    return null;
  }

  return {
    latitude: latestLocation.coords.latitude,
    longitude: latestLocation.coords.longitude,
  };
};

const stopBackgroundMonitoringSafely = async (): Promise<void> => {
  try {
    const hasStartedUpdates = await Location.hasStartedLocationUpdatesAsync(
      NEAR_DESTINATION_LOCATION_TASK
    );

    if (hasStartedUpdates) {
      await Location.stopLocationUpdatesAsync(NEAR_DESTINATION_LOCATION_TASK);
    }
  } catch (error) {
    console.warn('Unable to stop near-destination background monitoring', error);
  }
};

TaskManager.defineTask(NEAR_DESTINATION_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Near-destination background task failed', error.message);
    return;
  }

  const session = await readActiveNavigationSession();

  if (!session) {
    await stopBackgroundMonitoringSafely();
    return;
  }

  if (!session.nearDestinationEnabled) {
    await clearActiveNavigationSession();
    await stopBackgroundMonitoringSafely();
    return;
  }

  const latestLocation = readLatestLocation(data);

  if (!latestLocation) {
    return;
  }

  const distanceMeters = calculateDistanceMeters(latestLocation, session.destination);

  if (distanceMeters > session.alertRadiusMeters) {
    return;
  }

  try {
    const scheduled = await scheduleArrivalNotification({
      routeId: session.routeId,
      targetLabel: session.destination.label,
      alertRadiusMeters: session.alertRadiusMeters,
      alarmMode: session.alarmMode,
    });

    if (!scheduled) {
      console.warn('Unable to show near-destination background notification');
    }
  } finally {
    await Promise.all([
      stopBackgroundMonitoringSafely(),
      clearActiveNavigationSession(),
    ]);
  }
});
