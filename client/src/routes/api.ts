import { isRecord, requestData } from '../api/base';
import type { PlaceMatchSource, SelectedPlace } from '../places/types';
import type {
  FareBreakdown,
  PassengerType,
  RouteModifier,
  RideMode,
  RoutePreference,
  RouteQueryIncident,
  RouteQueryLeg,
  RouteQueryOption,
  RouteQueryPointInput,
  RouteQueryResult,
  RouteStop,
} from './types';

const parseString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field} in route response`);
  }

  return value;
};

const parseNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid ${field} in route response`);
  }

  return value;
};

const parseNullableString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return parseString(value, field);
};

const parseStop = (value: unknown): RouteStop => {
  if (!isRecord(value)) {
    throw new Error('Invalid route stop');
  }

  return {
    id: parseString(value.id, 'stop.id'),
    placeId: parseNullableString(value.placeId, 'stop.placeId'),
    externalStopCode: parseNullableString(value.externalStopCode, 'stop.externalStopCode'),
    stopName: parseString(value.stopName, 'stop.stopName'),
    mode: parseString(value.mode, 'stop.mode') as RouteStop['mode'],
    area: parseString(value.area, 'stop.area'),
    latitude: parseNumber(value.latitude, 'stop.latitude'),
    longitude: parseNumber(value.longitude, 'stop.longitude'),
    isActive: Boolean(value.isActive),
    createdAt: parseString(value.createdAt, 'stop.createdAt'),
  };
};

const parseFareBreakdown = (value: unknown): FareBreakdown => {
  if (!isRecord(value)) {
    throw new Error('Invalid fare breakdown');
  }

  return {
    amount: parseNumber(value.amount, 'fare.amount'),
    pricingType: parseString(value.pricingType, 'fare.pricingType'),
    fareProductCode: parseNullableString(value.fareProductCode, 'fare.fareProductCode'),
    ruleVersionName: parseNullableString(value.ruleVersionName, 'fare.ruleVersionName'),
    effectivityDate: parseNullableString(value.effectivityDate, 'fare.effectivityDate'),
    isDiscountApplied: Boolean(value.isDiscountApplied),
    assumptionText: parseNullableString(value.assumptionText, 'fare.assumptionText'),
  };
};

const parseLeg = (value: unknown): RouteQueryLeg => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('Invalid route leg');
  }

  if (value.type === 'walk') {
    return {
      type: 'walk',
      id: parseString(value.id, 'walk.id'),
      fromLabel: parseString(value.fromLabel, 'walk.fromLabel'),
      toLabel: parseString(value.toLabel, 'walk.toLabel'),
      distanceMeters: parseNumber(value.distanceMeters, 'walk.distanceMeters'),
      durationMinutes: parseNumber(value.durationMinutes, 'walk.durationMinutes'),
      fare: parseFareBreakdown(value.fare),
    };
  }

  if (value.type === 'drive') {
    return {
      type: 'drive',
      id: parseString(value.id, 'drive.id'),
      mode: 'car',
      fromLabel: parseString(value.fromLabel, 'drive.fromLabel'),
      toLabel: parseString(value.toLabel, 'drive.toLabel'),
      distanceKm: parseNumber(value.distanceKm, 'drive.distanceKm'),
      durationMinutes: parseNumber(value.durationMinutes, 'drive.durationMinutes'),
      fare: parseFareBreakdown(value.fare),
    };
  }

  return {
    type: 'ride',
    id: parseString(value.id, 'ride.id'),
    mode: parseString(value.mode, 'ride.mode') as RideMode,
    routeId: parseString(value.routeId, 'ride.routeId'),
    routeVariantId: parseString(value.routeVariantId, 'ride.routeVariantId'),
    routeCode: parseString(value.routeCode, 'ride.routeCode'),
    routeName: parseString(value.routeName, 'ride.routeName'),
    directionLabel: parseString(value.directionLabel, 'ride.directionLabel'),
    fromStop: parseStop(value.fromStop),
    toStop: parseStop(value.toStop),
    routeLabel: parseString(value.routeLabel, 'ride.routeLabel'),
    distanceKm: parseNumber(value.distanceKm, 'ride.distanceKm'),
    durationMinutes: parseNumber(value.durationMinutes, 'ride.durationMinutes'),
    corridorTags: Array.isArray(value.corridorTags)
      ? value.corridorTags.map((tag) => parseString(tag, 'ride.corridorTags'))
      : [],
    fare: parseFareBreakdown(value.fare),
  };
};

const parseIncident = (value: unknown): RouteQueryIncident => {
  if (!isRecord(value)) {
    throw new Error('Invalid route incident');
  }

  const severity = parseString(value.severity, 'incident.severity');

  if (severity !== 'low' && severity !== 'medium' && severity !== 'high') {
    throw new Error('Invalid incident severity');
  }

  return {
    id: parseString(value.id, 'incident.id'),
    alertType: parseString(value.alertType, 'incident.alertType'),
    location: parseString(value.location, 'incident.location'),
    direction: parseNullableString(value.direction, 'incident.direction'),
    severity,
    summary: parseString(value.summary, 'incident.summary'),
    displayUntil: parseString(value.displayUntil, 'incident.displayUntil'),
    scrapedAt: parseString(value.scrapedAt, 'incident.scrapedAt'),
    sourceUrl: parseString(value.sourceUrl, 'incident.sourceUrl'),
  };
};

const parseRouteOption = (value: unknown): RouteQueryOption => {
  if (!isRecord(value)) {
    throw new Error('Invalid route option');
  }

  return {
    id: parseString(value.id, 'option.id'),
    summary: parseString(value.summary, 'option.summary'),
    recommendationLabel: parseString(value.recommendationLabel, 'option.recommendationLabel'),
    highlights: Array.isArray(value.highlights)
      ? value.highlights.map((item) => parseString(item, 'option.highlights'))
      : [],
    totalDurationMinutes: parseNumber(value.totalDurationMinutes, 'option.totalDurationMinutes'),
    totalFare: parseNumber(value.totalFare, 'option.totalFare'),
    fareConfidence: parseString(value.fareConfidence, 'option.fareConfidence') as RouteQueryOption['fareConfidence'],
    transferCount: parseNumber(value.transferCount, 'option.transferCount'),
    corridorTags: Array.isArray(value.corridorTags)
      ? value.corridorTags.map((item) => parseString(item, 'option.corridorTags'))
      : [],
    fareAssumptions: Array.isArray(value.fareAssumptions)
      ? value.fareAssumptions.map((item) => parseString(item, 'option.fareAssumptions'))
      : [],
    legs: Array.isArray(value.legs) ? value.legs.map(parseLeg) : [],
    relevantIncidents: Array.isArray(value.relevantIncidents)
      ? value.relevantIncidents.map(parseIncident)
      : [],
  };
};

const parseNormalizedPoint = (value: unknown) => {
  if (!isRecord(value)) {
    throw new Error('Invalid normalized point');
  }

  return {
    placeId: parseString(value.placeId, 'normalized.placeId'),
    label: parseString(value.label, 'normalized.label'),
    matchedBy: parseString(value.matchedBy, 'normalized.matchedBy') as PlaceMatchSource,
  };
};

const parseRouteQueryResult = (value: unknown): RouteQueryResult => {
  if (!isRecord(value) || !isRecord(value.normalizedQuery)) {
    throw new Error('Invalid route query response');
  }

  return {
    normalizedQuery: {
      origin: parseNormalizedPoint(value.normalizedQuery.origin),
      destination: parseNormalizedPoint(value.normalizedQuery.destination),
      preference: parseString(value.normalizedQuery.preference, 'normalized.preference') as RouteQueryResult['normalizedQuery']['preference'],
      passengerType: parseString(value.normalizedQuery.passengerType, 'normalized.passengerType') as RouteQueryResult['normalizedQuery']['passengerType'],
      preferenceSource: parseString(value.normalizedQuery.preferenceSource, 'normalized.preferenceSource'),
      passengerTypeSource: parseString(value.normalizedQuery.passengerTypeSource, 'normalized.passengerTypeSource'),
      modifiers: Array.isArray(value.normalizedQuery.modifiers)
        ? value.normalizedQuery.modifiers.map(
            (item) => parseString(item, 'normalized.modifiers') as RouteModifier
          )
        : [],
      modifierSource: parseString(value.normalizedQuery.modifierSource, 'normalized.modifierSource'),
    },
    options: Array.isArray(value.options) ? value.options.map(parseRouteOption) : [],
    message: typeof value.message === 'string' ? value.message : undefined,
  };
};

const toPointInput = (place: SelectedPlace): RouteQueryPointInput => ({
  placeId: place.placeId,
  googlePlaceId: place.googlePlaceId,
  label: place.label,
  latitude: place.latitude,
  longitude: place.longitude,
});

export const queryRoutes = async (input: {
  origin: SelectedPlace;
  destination: SelectedPlace;
  preference: RoutePreference;
  passengerType?: 'regular' | 'student' | 'senior' | 'pwd';
  modifiers?: RouteModifier[];
  accessToken?: string;
}): Promise<RouteQueryResult> =>
  requestData(
    {
      method: 'POST',
      path: '/api/routes/query',
      accessToken: input.accessToken,
      body: {
        origin: toPointInput(input.origin),
        destination: toPointInput(input.destination),
        preference: input.preference,
        passengerType: input.passengerType ?? 'regular',
        modifiers: input.modifiers,
      },
    },
    parseRouteQueryResult
  );

export const queryRoutesByText = async (input: {
  queryText: string;
  preference: RoutePreference;
  passengerType?: PassengerType;
  modifiers?: RouteModifier[];
  accessToken?: string;
}): Promise<RouteQueryResult> =>
  requestData(
    {
      method: 'POST',
      path: '/api/routes/query',
      accessToken: input.accessToken,
      body: {
        queryText: input.queryText,
        preference: input.preference,
        passengerType: input.passengerType ?? 'regular',
        modifiers: input.modifiers,
      },
    },
    parseRouteQueryResult
  );
