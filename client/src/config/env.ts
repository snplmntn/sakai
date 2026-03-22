const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const normalizeEnvValue = (value: string | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const readRequiredPublicEnv = (name: string, value: string | undefined): string => {
  const normalizedValue = normalizeEnvValue(value);

  if (normalizedValue === null) {
    throw new Error(`Missing ${name}. Set it in client/.env before running the app.`);
  }

  return normalizedValue;
};

export const hasGoogleMapsApiKey = (): boolean => normalizeEnvValue(GOOGLE_MAPS_API_KEY) !== null;

export const hasGooglePlacesApiKey = (): boolean =>
  normalizeEnvValue(GOOGLE_PLACES_API_KEY) !== null || hasGoogleMapsApiKey();

export const readGoogleMapsApiKey = (): string =>
  readRequiredPublicEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', GOOGLE_MAPS_API_KEY);

export const readGooglePlacesApiKey = (): string =>
  normalizeEnvValue(GOOGLE_PLACES_API_KEY) ?? readGoogleMapsApiKey();
