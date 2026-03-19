import type { SelectedPlace } from '../places/types';
import type { RouteQueryLeg, RouteQueryOption, RouteQueryResult, RouteStop } from './types';

export interface MapMarkerViewModel {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  role: 'origin' | 'destination' | 'stop' | 'transfer';
}

const formatCurrency = (value: number) => `PHP ${value.toFixed(value % 1 === 0 ? 0 : 2)}`;

export const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
};

export const formatFare = (value: number) => formatCurrency(value);

const isRideLeg = (leg: RouteQueryLeg): leg is Extract<RouteQueryLeg, { type: 'ride' }> =>
  leg.type === 'ride';

const addStopMarker = (
  markerMap: Map<string, MapMarkerViewModel>,
  stop: RouteStop,
  role: 'stop' | 'transfer',
  subtitle: string
) => {
  if (markerMap.has(stop.id)) {
    return;
  }

  markerMap.set(stop.id, {
    id: stop.id,
    latitude: stop.latitude,
    longitude: stop.longitude,
    title: stop.stopName,
    subtitle,
    role,
  });
};

export const buildRouteMarkers = (input: {
  origin: SelectedPlace | null;
  destination: SelectedPlace | null;
  option: RouteQueryOption | null;
}): MapMarkerViewModel[] => {
  const markerMap = new Map<string, MapMarkerViewModel>();
  const rideLegs = input.option?.legs.filter(isRideLeg) ?? [];

  if (input.origin?.latitude !== undefined && input.origin.longitude !== undefined) {
    markerMap.set('origin', {
      id: 'origin',
      latitude: input.origin.latitude,
      longitude: input.origin.longitude,
      title: input.origin.label,
      subtitle: 'Origin',
      role: 'origin',
    });
  } else if (rideLegs[0]) {
    markerMap.set('origin', {
      id: 'origin',
      latitude: rideLegs[0].fromStop.latitude,
      longitude: rideLegs[0].fromStop.longitude,
      title: rideLegs[0].fromStop.stopName,
      subtitle: 'Origin stop',
      role: 'origin',
    });
  }

  if (input.destination?.latitude !== undefined && input.destination.longitude !== undefined) {
    markerMap.set('destination', {
      id: 'destination',
      latitude: input.destination.latitude,
      longitude: input.destination.longitude,
      title: input.destination.label,
      subtitle: 'Destination',
      role: 'destination',
    });
  } else if (rideLegs.at(-1)) {
    const lastRideLeg = rideLegs.at(-1);

    if (lastRideLeg) {
      markerMap.set('destination', {
        id: 'destination',
        latitude: lastRideLeg.toStop.latitude,
        longitude: lastRideLeg.toStop.longitude,
        title: lastRideLeg.toStop.stopName,
        subtitle: 'Destination stop',
        role: 'destination',
      });
    }
  }

  rideLegs.forEach((rideLeg, index) => {
    addStopMarker(
      markerMap,
      rideLeg.fromStop,
      index > 0 ? 'transfer' : 'stop',
      index > 0 ? 'Transfer stop' : 'Board here'
    );
    addStopMarker(
      markerMap,
      rideLeg.toStop,
      index < rideLegs.length - 1 ? 'transfer' : 'stop',
      index < rideLegs.length - 1 ? 'Transfer stop' : 'Get off here'
    );
  });

  return [...markerMap.values()];
};

const buildCoordinateFallbackMessage = (
  role: 'origin' | 'destination',
  selectedPlace: SelectedPlace | null
): string | null => {
  if (!selectedPlace || selectedPlace.source === 'sakai') {
    return null;
  }

  if (selectedPlace.source === 'current-location') {
    return `Your ${role} is based on the nearest Sakai-supported stop to your current location.`;
  }

  return `Your ${role} is based on the nearest Sakai-supported stop near the selected Google Maps place.`;
};

export const buildCoordinateFallbackNote = (input: {
  routeResult: RouteQueryResult | null;
  origin: SelectedPlace | null;
  destination: SelectedPlace | null;
}): string | null => {
  if (!input.routeResult) {
    return null;
  }

  const messages = [
    input.routeResult.normalizedQuery.origin.matchedBy === 'coordinates'
      ? buildCoordinateFallbackMessage('origin', input.origin)
      : null,
    input.routeResult.normalizedQuery.destination.matchedBy === 'coordinates'
      ? buildCoordinateFallbackMessage('destination', input.destination)
      : null,
  ].filter((message): message is string => message !== null);

  return messages.length > 0 ? messages.join(' ') : null;
};
