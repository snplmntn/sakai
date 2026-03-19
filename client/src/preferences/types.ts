import type { PassengerType, RoutePreference } from '../routes/types';
import { isRecord } from '../api/base';

export interface UserPreferences {
  userId: string | null;
  defaultPreference: RoutePreference;
  passengerType: PassengerType;
  isPersisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StoredPreferences {
  defaultPreference: RoutePreference;
  passengerType: PassengerType;
  syncStatus: 'pending' | 'synced';
}

export const DEFAULT_ROUTE_PREFERENCE: RoutePreference = 'balanced';
export const DEFAULT_PASSENGER_TYPE: PassengerType = 'regular';

export const createDefaultUserPreferences = (): UserPreferences => ({
  userId: null,
  defaultPreference: DEFAULT_ROUTE_PREFERENCE,
  passengerType: DEFAULT_PASSENGER_TYPE,
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

const isRoutePreference = (value: unknown): value is RoutePreference =>
  value === 'balanced' || value === 'cheapest' || value === 'fastest';

const isPassengerType = (value: unknown): value is PassengerType =>
  value === 'regular' || value === 'student' || value === 'senior' || value === 'pwd';

const readNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const readBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${fieldName} to be a boolean`);
  }

  return value;
};

export const parseUserPreferences = (value: unknown): UserPreferences => {
  if (!isRecord(value)) {
    throw new Error('Expected user preferences to be an object');
  }

  if (!isRoutePreference(value.defaultPreference)) {
    throw new Error('Expected defaultPreference to be a valid route preference');
  }

  if (!isPassengerType(value.passengerType)) {
    throw new Error('Expected passengerType to be a valid passenger type');
  }

  return {
    userId: readNullableString(value.userId),
    defaultPreference: value.defaultPreference,
    passengerType: value.passengerType,
    isPersisted: readBoolean(value.isPersisted, 'isPersisted'),
    createdAt: readNullableString(value.createdAt),
    updatedAt: readNullableString(value.updatedAt),
  };
};

export const parseStoredPreferences = (value: unknown): StoredPreferences => {
  if (!isRecord(value)) {
    throw new Error('Expected stored preferences to be an object');
  }

  if (!isRoutePreference(value.defaultPreference)) {
    throw new Error('Expected stored defaultPreference to be valid');
  }

  if (!isPassengerType(value.passengerType)) {
    throw new Error('Expected stored passengerType to be valid');
  }

  if (value.syncStatus !== 'pending' && value.syncStatus !== 'synced') {
    throw new Error('Expected stored syncStatus to be pending or synced');
  }

  return {
    defaultPreference: value.defaultPreference,
    passengerType: value.passengerType,
    syncStatus: value.syncStatus,
  };
};

export const toStoredPreferences = (
  value: Pick<UserPreferences, 'defaultPreference' | 'passengerType'>,
  syncStatus: StoredPreferences['syncStatus']
): StoredPreferences => ({
  defaultPreference: value.defaultPreference,
  passengerType: value.passengerType,
  syncStatus,
});

export const toUserPreferencesFromStored = (value: StoredPreferences): UserPreferences => ({
  ...createDefaultUserPreferences(),
  defaultPreference: value.defaultPreference,
  passengerType: value.passengerType,
  isPersisted: value.syncStatus === 'synced',
});
