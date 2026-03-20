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

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapRouteSegmentViewModel {
  id: string;
  type: RouteQueryLeg['type'];
  mode: string;
  coordinates: MapCoordinate[];
  isFallbackGeometry: boolean;
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

export const formatFare = (value: number | null) =>
  value === null ? 'Fare unavailable' : formatCurrency(value);

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

const toCoordinate = (latitude: number, longitude: number): MapCoordinate => ({
  latitude,
  longitude,
});

const resolvePointCoordinate = (
  selectedPlace: SelectedPlace | null,
  fallback: RouteQueryResult['normalizedQuery']['origin'] | RouteQueryResult['normalizedQuery']['destination']
): MapCoordinate | null => {
  if (selectedPlace?.latitude !== undefined && selectedPlace.longitude !== undefined) {
    return toCoordinate(selectedPlace.latitude, selectedPlace.longitude);
  }

  if (typeof fallback.latitude === 'number' && typeof fallback.longitude === 'number') {
    return toCoordinate(fallback.latitude, fallback.longitude);
  }

  return null;
};

export const buildRouteMarkers = (input: {
  origin: SelectedPlace | null;
  destination: SelectedPlace | null;
  routeResult: RouteQueryResult | null;
  option: RouteQueryOption | null;
}): MapMarkerViewModel[] => {
  const markerMap = new Map<string, MapMarkerViewModel>();
  const rideLegs = input.option?.legs.filter(isRideLeg) ?? [];
  const originCoordinate = input.routeResult
    ? resolvePointCoordinate(input.origin, input.routeResult.normalizedQuery.origin)
    : null;
  const destinationCoordinate = input.routeResult
    ? resolvePointCoordinate(input.destination, input.routeResult.normalizedQuery.destination)
    : null;

  if (originCoordinate) {
    markerMap.set('origin', {
      id: 'origin',
      latitude: originCoordinate.latitude,
      longitude: originCoordinate.longitude,
      title: input.origin?.label ?? input.routeResult?.normalizedQuery.origin.label ?? 'Origin',
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

  if (destinationCoordinate) {
    markerMap.set('destination', {
      id: 'destination',
      latitude: destinationCoordinate.latitude,
      longitude: destinationCoordinate.longitude,
      title:
        input.destination?.label ?? input.routeResult?.normalizedQuery.destination.label ?? 'Destination',
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

export const buildRouteSegments = (input: {
  origin: SelectedPlace | null;
  destination: SelectedPlace | null;
  routeResult: RouteQueryResult | null;
  option: RouteQueryOption | null;
}): MapRouteSegmentViewModel[] => {
  if (!input.option || !input.routeResult) {
    return [];
  }

  const option = input.option;
  const originCoordinate = resolvePointCoordinate(input.origin, input.routeResult.normalizedQuery.origin);
  const destinationCoordinate = resolvePointCoordinate(
    input.destination,
    input.routeResult.normalizedQuery.destination
  );
  const segments: MapRouteSegmentViewModel[] = [];
  let previousAnchor = originCoordinate;

  option.legs.forEach((leg, index) => {
    if (leg.type === 'ride') {
      const fromCoordinate = toCoordinate(leg.fromStop.latitude, leg.fromStop.longitude);
      const toCoordinateValue = toCoordinate(leg.toStop.latitude, leg.toStop.longitude);

      segments.push({
        id: leg.id,
        type: leg.type,
        mode: leg.mode,
        coordinates:
          Array.isArray(leg.pathCoordinates) && leg.pathCoordinates.length >= 2
            ? leg.pathCoordinates
            : [fromCoordinate, toCoordinateValue],
        isFallbackGeometry:
          !(Array.isArray(leg.pathCoordinates) && leg.pathCoordinates.length >= 2),
      });

      previousAnchor = toCoordinateValue;
      return;
    }

    const nextRideLeg = option.legs.slice(index + 1).find(isRideLeg);
    const startCoordinate = previousAnchor ?? originCoordinate;
    const endCoordinate = nextRideLeg
      ? toCoordinate(nextRideLeg.fromStop.latitude, nextRideLeg.fromStop.longitude)
      : destinationCoordinate;

    if (!startCoordinate || !endCoordinate) {
      return;
    }

    segments.push({
      id: leg.id,
      type: leg.type,
      mode: leg.type === 'drive' ? 'car' : 'walk',
      coordinates:
        Array.isArray(leg.pathCoordinates) && leg.pathCoordinates.length >= 2
          ? leg.pathCoordinates
          : [startCoordinate, endCoordinate],
      isFallbackGeometry:
        !(Array.isArray(leg.pathCoordinates) && leg.pathCoordinates.length >= 2),
    });

    previousAnchor = endCoordinate;
  });

  return segments;
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
