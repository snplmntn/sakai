const readPublicEnv = (name: string): string => {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing ${name}. Set it in client/.env before running the app.`);
  }

  return value.trim();
};

const readOptionalPublicEnv = (name: string): string | null => {
  const value = process.env[name];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

export const hasGoogleMapsApiKey = (): boolean =>
  readOptionalPublicEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') !== null;

export const hasGooglePlacesApiKey = (): boolean =>
  readOptionalPublicEnv('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY') !== null || hasGoogleMapsApiKey();

export const readGoogleMapsApiKey = (): string =>
  readPublicEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');

export const readGooglePlacesApiKey = (): string =>
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
  readGoogleMapsApiKey();
