import type { SelectedPlace } from '../places/types';
import type { RouteQueryLeg, RouteQueryOption } from '../routes/types';
import type { AlertRadiusMeters, NavigationTarget } from './types';

export const ALERT_RADIUS_OPTIONS: Array<{ label: string; value: AlertRadiusMeters }> = [
  { label: '150 m', value: 150 },
  { label: '300 m', value: 300 },
  { label: '500 m', value: 500 },
];

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (value: number): number => (value * Math.PI) / 180;

const isRideLeg = (leg: RouteQueryLeg): leg is Extract<RouteQueryLeg, { type: 'ride' }> =>
  leg.type === 'ride';

export const calculateDistanceMeters = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): number => {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitudeRadians = toRadians(origin.latitude);
  const destinationLatitudeRadians = toRadians(destination.latitude);

  const haversineValue =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitudeRadians) *
      Math.cos(destinationLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
};

export const resolveNavigationTarget = (input: {
  destination: SelectedPlace | null;
  option: RouteQueryOption | null;
}): NavigationTarget | null => {
  if (input.destination?.latitude !== undefined && input.destination.longitude !== undefined) {
    return {
      latitude: input.destination.latitude,
      longitude: input.destination.longitude,
      label: input.destination.label,
    };
  }

  const rideLegs = input.option?.legs.filter(isRideLeg) ?? [];
  const lastRideLeg = rideLegs.at(-1);

  if (!lastRideLeg) {
    return null;
  }

  return {
    latitude: lastRideLeg.toStop.latitude,
    longitude: lastRideLeg.toStop.longitude,
    label: lastRideLeg.toStop.stopName,
  };
};

export const formatDistanceAway = (distanceMeters: number | null): string => {
  if (distanceMeters === null) {
    return 'Waiting for your location...';
  }

  if (distanceMeters < 1000) {
    return `${Math.max(1, Math.round(distanceMeters))} m away`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km away`;
};

