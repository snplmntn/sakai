import { isRecord, requestData } from '../api/base';
import { readGooglePlacesApiKey } from '../config/env';
import type {
  GooglePlaceSuggestion,
  PlaceSuggestion,
  SakaiPlaceSuggestion,
  SelectedPlace,
} from './types';

const parseString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field} in place response`);
  }

  return value;
};

const parseNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid ${field} in place response`);
  }

  return value;
};

const parseNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return parseString(value, 'string');
};

const parseSakaiSuggestion = (value: unknown): SakaiPlaceSuggestion => {
  if (!isRecord(value)) {
    throw new Error('Invalid Sakai place suggestion');
  }

  return {
    source: 'sakai',
    id: parseString(value.id, 'id'),
    label: parseString(value.canonicalName, 'canonicalName'),
    city: parseString(value.city, 'city'),
    kind: parseString(value.kind, 'kind') as SakaiPlaceSuggestion['kind'],
    latitude: parseNumber(value.latitude, 'latitude'),
    longitude: parseNumber(value.longitude, 'longitude'),
    googlePlaceId: parseNullableString(value.googlePlaceId),
    matchedBy: parseString(value.matchedBy, 'matchedBy') as SakaiPlaceSuggestion['matchedBy'],
    matchedText: parseString(value.matchedText, 'matchedText'),
  };
};

const parseSakaiSuggestions = (value: unknown): SakaiPlaceSuggestion[] => {
  if (!Array.isArray(value)) {
    throw new Error('Invalid Sakai place search response');
  }

  return value.map(parseSakaiSuggestion);
};

const parseGoogleSuggestion = (value: unknown): GooglePlaceSuggestion => {
  if (!isRecord(value)) {
    throw new Error('Invalid Google place suggestion');
  }

  return {
    source: 'google',
    googlePlaceId: parseString(value.place_id, 'place_id'),
    label: isRecord(value.structured_formatting)
      ? parseString(value.structured_formatting.main_text, 'structured_formatting.main_text')
      : parseString(value.description, 'description'),
    secondaryText: isRecord(value.structured_formatting)
      ? typeof value.structured_formatting.secondary_text === 'string'
        ? value.structured_formatting.secondary_text
        : ''
      : '',
  };
};

const parseGoogleResponseStatus = (
  body: unknown,
  allowedStatuses: readonly string[],
  fallbackMessage: string
): string => {
  if (!isRecord(body) || typeof body.status !== 'string') {
    throw new Error(fallbackMessage);
  }

  if (!allowedStatuses.includes(body.status)) {
    const errorMessage =
      typeof body.error_message === 'string' && body.error_message.trim().length > 0
        ? body.error_message
        : fallbackMessage;

    throw new Error(errorMessage);
  }

  return body.status;
};

const buildGoogleUrl = (path: string, params: Record<string, string>): string => {
  const query = new URLSearchParams(params).toString();
  return `${path}?${query}`;
};

export const searchSakaiPlaces = async (
  query: string,
  limit = 5
): Promise<SakaiPlaceSuggestion[]> =>
  requestData(
    {
      method: 'GET',
      path: `/api/places/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    },
    parseSakaiSuggestions
  );

export const searchGooglePlaces = async (
  query: string,
  limit = 5,
  options?: {
    sessionToken?: string;
  }
): Promise<GooglePlaceSuggestion[]> => {
  const params: Record<string, string> = {
    input: query,
    key: readGooglePlacesApiKey(),
    components: 'country:ph',
    language: 'en',
    region: 'ph',
  };

  if (options?.sessionToken) {
    params.sessiontoken = options.sessionToken;
  }

  const response = await fetch(
    buildGoogleUrl('https://maps.googleapis.com/maps/api/place/autocomplete/json', params)
  );
  const body = (await response.json()) as unknown;

  if (!isRecord(body) || !Array.isArray(body.predictions)) {
    throw new Error('Invalid Google autocomplete response');
  }

  const status = parseGoogleResponseStatus(
    body,
    ['OK', 'ZERO_RESULTS'],
    'Google Maps autocomplete is unavailable right now.'
  );

  if (status === 'ZERO_RESULTS') {
    return [];
  }

  return body.predictions
    .map(parseGoogleSuggestion)
    .slice(0, limit);
};

export const getGooglePlaceDetails = async (
  googlePlaceId: string,
  options?: {
    sessionToken?: string;
  }
): Promise<SelectedPlace> => {
  const params: Record<string, string> = {
    place_id: googlePlaceId,
    key: readGooglePlacesApiKey(),
    fields: 'place_id,name,formatted_address,geometry',
  };

  if (options?.sessionToken) {
    params.sessiontoken = options.sessionToken;
  }

  const response = await fetch(
    buildGoogleUrl('https://maps.googleapis.com/maps/api/place/details/json', params)
  );
  const body = (await response.json()) as unknown;

  parseGoogleResponseStatus(body, ['OK'], 'Google Maps place details are unavailable right now.');

  if (!isRecord(body) || !isRecord(body.result) || !isRecord(body.result.geometry)) {
    throw new Error('Invalid Google place details response');
  }

  const location = body.result.geometry.location;

  if (!isRecord(location)) {
    throw new Error('Invalid Google place geometry response');
  }

  return {
    source: 'google',
    googlePlaceId: parseString(body.result.place_id, 'result.place_id'),
    label:
      typeof body.result.name === 'string' && body.result.name.trim().length > 0
        ? body.result.name
        : parseString(body.result.formatted_address, 'result.formatted_address'),
    latitude: parseNumber(location.lat, 'result.geometry.location.lat'),
    longitude: parseNumber(location.lng, 'result.geometry.location.lng'),
  };
};

export const reverseGeocodeCurrentLocation = async (input: {
  latitude: number;
  longitude: number;
}): Promise<SelectedPlace> => {
  const response = await fetch(
    buildGoogleUrl('https://maps.googleapis.com/maps/api/geocode/json', {
      latlng: `${input.latitude},${input.longitude}`,
      key: readGooglePlacesApiKey(),
      language: 'en',
    })
  );
  const body = (await response.json()) as unknown;

  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new Error('Invalid Google reverse geocode response');
  }

  const status = parseGoogleResponseStatus(
    body,
    ['OK', 'ZERO_RESULTS'],
    'Google Maps reverse geocoding is unavailable right now.'
  );

  if (status === 'ZERO_RESULTS') {
    return {
      source: 'current-location',
      label: 'Current location',
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }

  const firstResult = body.results.find((result) => isRecord(result));

  return {
    source: 'current-location',
    label:
      firstResult && typeof firstResult.formatted_address === 'string'
        ? firstResult.formatted_address
        : 'Current location',
    latitude: input.latitude,
    longitude: input.longitude,
  };
};

export interface GoogleDirectionsCoordinate {
  latitude: number;
  longitude: number;
}

const decodeGooglePolyline = (encoded: string): GoogleDirectionsCoordinate[] => {
  const coordinates: GoogleDirectionsCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
};

export const getGoogleDirectionsPath = async (input: {
  origin: GoogleDirectionsCoordinate;
  destination: GoogleDirectionsCoordinate;
  mode: 'walking' | 'driving';
}): Promise<GoogleDirectionsCoordinate[] | null> => {
  const response = await fetch(
    buildGoogleUrl('https://maps.googleapis.com/maps/api/directions/json', {
      origin: `${input.origin.latitude},${input.origin.longitude}`,
      destination: `${input.destination.latitude},${input.destination.longitude}`,
      mode: input.mode,
      key: readGooglePlacesApiKey(),
      language: 'en',
      region: 'ph',
    })
  );
  const body = (await response.json()) as unknown;

  const status = parseGoogleResponseStatus(
    body,
    ['OK', 'ZERO_RESULTS'],
    'Google Maps directions are unavailable right now.'
  );

  if (status === 'ZERO_RESULTS') {
    return null;
  }

  if (!isRecord(body) || !Array.isArray(body.routes) || body.routes.length === 0) {
    throw new Error('Invalid Google directions response');
  }

  const firstRoute = body.routes[0];

  if (!isRecord(firstRoute) || !isRecord(firstRoute.overview_polyline)) {
    throw new Error('Invalid Google directions polyline response');
  }

  const encodedPolyline = parseString(firstRoute.overview_polyline.points, 'overview_polyline.points');
  const coordinates = decodeGooglePolyline(encodedPolyline);

  return coordinates.length > 0 ? coordinates : null;
};

export const toSelectedPlace = (suggestion: PlaceSuggestion): SelectedPlace => {
  if (suggestion.source === 'sakai') {
    return {
      source: 'sakai',
      label: suggestion.label,
      placeId: suggestion.id,
      googlePlaceId: suggestion.googlePlaceId ?? undefined,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      city: suggestion.city,
      kind: suggestion.kind,
      matchedBy: suggestion.matchedBy,
    };
  }

  return {
    source: 'google',
    label: suggestion.label,
    googlePlaceId: suggestion.googlePlaceId,
  };
};
