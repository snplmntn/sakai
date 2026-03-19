export type PlaceMatchSource =
  | 'placeId'
  | 'googlePlaceId'
  | 'alias'
  | 'canonicalName'
  | 'coordinates';

export type PlaceKind =
  | 'landmark'
  | 'station'
  | 'area'
  | 'campus'
  | 'mall'
  | 'terminal';

export interface SakaiPlaceSuggestion {
  source: 'sakai';
  id: string;
  label: string;
  city: string;
  kind: PlaceKind;
  latitude: number;
  longitude: number;
  googlePlaceId: string | null;
  matchedBy: PlaceMatchSource;
  matchedText: string;
}

export interface GooglePlaceSuggestion {
  source: 'google';
  googlePlaceId: string;
  label: string;
  secondaryText: string;
}

export type PlaceSuggestion = SakaiPlaceSuggestion | GooglePlaceSuggestion;

export interface SelectedPlace {
  source: 'sakai' | 'google' | 'current-location';
  label: string;
  placeId?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  kind?: PlaceKind;
  matchedBy?: PlaceMatchSource;
}
