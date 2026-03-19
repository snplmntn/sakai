import {
  getGooglePlaceDetails,
  searchGooglePlaces,
  searchSakaiPlaces,
  toSelectedPlace,
} from './api';
import type {
  GooglePlaceSuggestion,
  PlaceSuggestion,
  SakaiPlaceSuggestion,
  SelectedPlace,
} from './types';

const normalizeSuggestionText = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const createGooglePlaceSignature = (suggestion: PlaceSuggestion): string | null => {
  const googlePlaceId =
    suggestion.source === 'sakai' ? suggestion.googlePlaceId : suggestion.googlePlaceId;

  return googlePlaceId ? `googlePlaceId:${googlePlaceId}` : null;
};

const createDisplaySignature = (suggestion: PlaceSuggestion): string => {
  const secondaryText =
    suggestion.source === 'sakai' ? suggestion.city : suggestion.secondaryText;

  return `display:${normalizeSuggestionText(suggestion.label)}|${normalizeSuggestionText(
    secondaryText
  )}`;
};

export const createGooglePlacesSessionToken = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const getPlaceSuggestionKey = (suggestion: PlaceSuggestion): string =>
  suggestion.source === 'sakai' ? `sakai-${suggestion.id}` : `google-${suggestion.googlePlaceId}`;

export const mergePlaceSuggestions = (
  sakaiSuggestions: SakaiPlaceSuggestion[],
  googleSuggestions: GooglePlaceSuggestion[]
): PlaceSuggestion[] => {
  const mergedSuggestions: PlaceSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of [...sakaiSuggestions, ...googleSuggestions]) {
    const signatures = [
      createGooglePlaceSignature(suggestion),
      createDisplaySignature(suggestion),
    ].filter((signature): signature is string => signature !== null);

    if (signatures.some((signature) => seen.has(signature))) {
      continue;
    }

    signatures.forEach((signature) => seen.add(signature));
    mergedSuggestions.push(suggestion);
  }

  return mergedSuggestions;
};

export const searchMergedPlaceSuggestions = async (input: {
  query: string;
  limit?: number;
  canUseGooglePlaces: boolean;
  googleSessionToken?: string;
}): Promise<PlaceSuggestion[]> => {
  const query = input.query.trim();

  if (query.length < 2) {
    return [];
  }

  const limit = input.limit ?? 5;
  const [sakaiResult, googleResult] = await Promise.allSettled([
    searchSakaiPlaces(query, limit),
    input.canUseGooglePlaces
      ? searchGooglePlaces(query, limit, {
          sessionToken: input.googleSessionToken,
        })
      : Promise.resolve([] as GooglePlaceSuggestion[]),
  ]);

  const sakaiSuggestions = sakaiResult.status === 'fulfilled' ? sakaiResult.value : [];
  const googleSuggestions = googleResult.status === 'fulfilled' ? googleResult.value : [];

  if (sakaiResult.status === 'rejected' && googleResult.status === 'rejected') {
    throw new Error('Unable to search places right now.');
  }

  return mergePlaceSuggestions(sakaiSuggestions, googleSuggestions);
};

export const resolvePlaceSuggestion = async (
  suggestion: PlaceSuggestion,
  options?: {
    googleSessionToken?: string;
  }
): Promise<SelectedPlace> => {
  if (suggestion.source === 'sakai') {
    return toSelectedPlace(suggestion);
  }

  return getGooglePlaceDetails(suggestion.googlePlaceId, {
    sessionToken: options?.googleSessionToken,
  });
};
