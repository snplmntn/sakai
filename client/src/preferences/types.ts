import { isRecord } from '../api/base';
import type { PassengerType, RouteModifier, RoutePreference } from '../routes/types';

export type { PassengerType, RouteModifier, RoutePreference } from '../routes/types';

export interface PreferenceDraft {
  defaultPreference: RoutePreference;
  passengerType: PassengerType;
  routeModifiers: RouteModifier[];
}

export interface UserPreferences extends PreferenceDraft {
  userId: string | null;
  isPersisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StoredPreferences extends PreferenceDraft {
  syncStatus: 'pending' | 'synced';
}

export const DEFAULT_ROUTE_PREFERENCE: RoutePreference = 'balanced';
export const DEFAULT_PASSENGER_TYPE: PassengerType = 'regular';

export const createDefaultUserPreferences = (): UserPreferences => ({
  userId: null,
  defaultPreference: DEFAULT_ROUTE_PREFERENCE,
  passengerType: DEFAULT_PASSENGER_TYPE,
  routeModifiers: [],
  isPersisted: false,
  createdAt: null,
  updatedAt: null,
});

export const ROUTE_PREFERENCE_OPTIONS: Array<{
  value: RoutePreference;
  label: string;
  description: string;
}> = [
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Keep fare and travel time in balance.',
  },
  {
    value: 'cheapest',
    label: 'Cheapest',
    description: 'Prefer lower total fare when route options differ.',
  },
  {
    value: 'fastest',
    label: 'Fastest',
    description: 'Prioritize shorter travel time and transfers.',
  },
];

export const PASSENGER_TYPE_OPTIONS: Array<{
  value: PassengerType;
  label: string;
  description: string;
}> = [
  {
    value: 'regular',
    label: 'Regular',
    description: 'Use standard fare pricing.',
  },
  {
    value: 'student',
    label: 'Student',
    description: 'Apply student jeepney discounts when supported.',
  },
  {
    value: 'senior',
    label: 'Senior',
    description: 'Apply senior fare discounts when supported.',
  },
  {
    value: 'pwd',
    label: 'PWD',
    description: 'Apply PWD fare discounts when supported.',
  },
];

export const ROUTE_MODIFIER_OPTIONS: Array<{
  value: RouteModifier;
  label: string;
  description: string;
}> = [
  {
    value: 'jeep_if_possible',
    label: 'Jeep if possible',
    description: 'Prefer routes that keep jeepney legs when practical.',
  },
  {
    value: 'less_walking',
    label: 'Less walking',
    description: 'Prefer options with shorter walking segments.',
  },
];

const isRoutePreference = (value: unknown): value is RoutePreference =>
  value === 'balanced' || value === 'cheapest' || value === 'fastest';

const isPassengerType = (value: unknown): value is PassengerType =>
  value === 'regular' || value === 'student' || value === 'senior' || value === 'pwd';

const isRouteModifier = (value: unknown): value is RouteModifier =>
  value === 'jeep_if_possible' || value === 'less_walking';

const readRouteModifiers = (value: unknown): RouteModifier[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('Expected routeModifiers to be an array');
  }

  const modifiers = value.filter(isRouteModifier);

  if (modifiers.length !== value.length) {
    throw new Error('Expected routeModifiers to contain valid route modifiers');
  }

  return [...new Set(modifiers)];
};

const readBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${fieldName} to be a boolean`);
  }

  return value;
};

const readNullableString = (value: unknown, fieldName: string): string | null => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string`);
  }

  return value;
};

export const parsePreferenceDraft = (value: unknown): PreferenceDraft => {
  if (!isRecord(value)) {
    throw new Error('Expected preference draft to be an object');
  }

  if (!isRoutePreference(value.defaultPreference)) {
    throw new Error('Expected defaultPreference to be a valid route preference');
  }

  if (!isPassengerType(value.passengerType)) {
    throw new Error('Expected passengerType to be a valid passenger type');
  }

  return {
    defaultPreference: value.defaultPreference,
    passengerType: value.passengerType,
    routeModifiers: readRouteModifiers(value.routeModifiers),
  };
};

export const parseUserPreferences = (value: unknown): UserPreferences => {
  if (!isRecord(value)) {
    throw new Error('Expected user preferences to be an object');
  }

  const draft = parsePreferenceDraft(value);

  return {
    ...draft,
    userId: readNullableString(value.userId ?? null, 'userId'),
    isPersisted: readBoolean(value.isPersisted, 'isPersisted'),
    createdAt: readNullableString(value.createdAt ?? null, 'createdAt'),
    updatedAt: readNullableString(value.updatedAt ?? null, 'updatedAt'),
  };
};

export const parseStoredPreferences = (value: unknown): StoredPreferences => {
  if (!isRecord(value)) {
    throw new Error('Expected stored preferences to be an object');
  }

  const draft = parsePreferenceDraft(value);

  if (value.syncStatus !== 'pending' && value.syncStatus !== 'synced') {
    throw new Error('Expected stored syncStatus to be pending or synced');
  }

  return {
    ...draft,
    syncStatus: value.syncStatus,
  };
};

export const toStoredPreferences = (
  value: PreferenceDraft,
  syncStatus: StoredPreferences['syncStatus']
): StoredPreferences => ({
  ...value,
  syncStatus,
});

export const toUserPreferencesFromStored = (value: StoredPreferences): UserPreferences => ({
  ...createDefaultUserPreferences(),
  ...value,
  isPersisted: value.syncStatus === 'synced',
});
