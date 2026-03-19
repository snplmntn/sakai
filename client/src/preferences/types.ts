export type RoutePreference = 'fastest' | 'cheapest' | 'balanced';

export type PassengerType = 'regular' | 'student' | 'senior' | 'pwd';

export interface PreferenceDraft {
  defaultPreference: RoutePreference;
  passengerType: PassengerType;
}

export interface UserPreferences extends PreferenceDraft {
  userId: string;
  isPersisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string`);
  }

  return value;
};

const readNullableString = (value: unknown, fieldName: string): string | null => {
  if (value === null) {
    return null;
  }

  return readString(value, fieldName);
};

const isRoutePreference = (value: unknown): value is RoutePreference =>
  value === 'fastest' || value === 'cheapest' || value === 'balanced';

const isPassengerType = (value: unknown): value is PassengerType =>
  value === 'regular' || value === 'student' || value === 'senior' || value === 'pwd';

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
  };
};

export const parseUserPreferences = (value: unknown): UserPreferences => {
  if (!isRecord(value)) {
    throw new Error('Expected user preferences to be an object');
  }

  const draft = parsePreferenceDraft(value);

  return {
    ...draft,
    userId: readString(value.userId, 'userId'),
    isPersisted: value.isPersisted === true,
    createdAt: readNullableString(value.createdAt ?? null, 'createdAt'),
    updatedAt: readNullableString(value.updatedAt ?? null, 'updatedAt'),
  };
};
