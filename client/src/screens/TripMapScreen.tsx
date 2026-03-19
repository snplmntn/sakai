import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { ApiError, isRecord } from '../api/base';
import { useAuth } from '../auth/AuthContext';
import MapSetupNotice from '../components/MapSetupNotice';
import SafeScreen from '../components/SafeScreen';
import { hasGoogleMapsApiKey, hasGooglePlacesApiKey } from '../config/env';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import {
  getGooglePlaceDetails,
  reverseGeocodeCurrentLocation,
  searchGooglePlaces,
  searchSakaiPlaces,
  toSelectedPlace,
} from '../places/api';
import type { PlaceSuggestion, SakaiPlaceSuggestion, SelectedPlace } from '../places/types';
import { queryRoutes } from '../routes/api';
import type { RoutePreference, RouteQueryOption, RouteQueryResult } from '../routes/types';
import { buildRouteMarkers, formatDuration, formatFare } from '../routes/view-models';
import { useToast } from '../toast/ToastContext';

const DEFAULT_REGION: Region = {
  latitude: 14.517,
  longitude: 121.024,
  latitudeDelta: 0.18,
  longitudeDelta: 0.12,
};

const SEARCH_EXAMPLES = ['Pasay', 'Magallanes', 'Gate 3'];
const PREFERENCES: Array<{ label: string; value: RoutePreference }> = [
  { label: 'Balanced', value: 'balanced' },
  { label: 'Cheapest', value: 'cheapest' },
  { label: 'Fastest', value: 'fastest' },
];

type ActiveField = 'origin' | 'destination' | null;

const mergeSuggestions = (
  sakaiSuggestions: SakaiPlaceSuggestion[],
  googleSuggestions: PlaceSuggestion[]
) => {
  const seen = new Set(sakaiSuggestions.map((item) => item.label.toLowerCase()));

  return [
    ...sakaiSuggestions,
    ...googleSuggestions.filter(
      (item) => item.source === 'google' && !seen.has(item.label.toLowerCase())
    ),
  ];
};

const mapDisambiguationMatches = (value: unknown): SakaiPlaceSuggestion[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    if (
      typeof item.id !== 'string' ||
      typeof item.canonicalName !== 'string' ||
      typeof item.city !== 'string' ||
      typeof item.kind !== 'string' ||
      typeof item.latitude !== 'number' ||
      typeof item.longitude !== 'number' ||
      typeof item.matchedBy !== 'string' ||
      typeof item.matchedText !== 'string'
    ) {
      return [];
    }

    return [
      {
        source: 'sakai' as const,
        id: item.id,
        label: item.canonicalName,
        city: item.city,
        kind: item.kind as SakaiPlaceSuggestion['kind'],
        latitude: item.latitude,
        longitude: item.longitude,
        googlePlaceId:
          typeof item.googlePlaceId === 'string' ? item.googlePlaceId : null,
        matchedBy: item.matchedBy as SakaiPlaceSuggestion['matchedBy'],
        matchedText: item.matchedText,
      },
    ];
  });
};

export default function TripMapScreen() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const mapRef = useRef<MapView | null>(null);

  const [preference, setPreference] = useState<RoutePreference>('balanced');
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originSelection, setOriginSelection] = useState<SelectedPlace | null>(null);
  const [destinationSelection, setDestinationSelection] = useState<SelectedPlace | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteQueryResult | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Choose a routeable stop or Google place.');
  const [isSearchingRoutes, setIsSearchingRoutes] = useState(false);

  const activeQuery = activeField === 'origin' ? originQuery : destinationQuery;
  const isGoogleMapsConfigured = hasGoogleMapsApiKey();
  const canUseGooglePlaces = hasGooglePlacesApiKey();

  const resolveCurrentOrigin = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      showToast({
        tone: 'info',
        title: 'Location unavailable',
        message: 'Choose your origin manually if location access is denied.',
      });
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const place = await reverseGeocodeCurrentLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    setOriginSelection(place);
    setOriginQuery(place.label);
    return place;
  };

  useEffect(() => {
    if (!activeField || activeQuery.trim().length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLoadingSuggestions(true);

        try {
          const [sakaiSuggestions, googleSuggestions] = await Promise.all([
            searchSakaiPlaces(activeQuery, 5),
            canUseGooglePlaces ? searchGooglePlaces(activeQuery, 5) : Promise.resolve([]),
          ]);

          if (!cancelled) {
            setSuggestions(mergeSuggestions(sakaiSuggestions, googleSuggestions));
          }
        } catch {
          if (!cancelled) {
            setSuggestions([]);
          }
        } finally {
          if (!cancelled) {
            setLoadingSuggestions(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeField, activeQuery, canUseGooglePlaces]);

  useEffect(() => {
    if (!originSelection || !destinationSelection) {
      return;
    }

    void (async () => {
      setIsSearchingRoutes(true);
      setStatusMessage('Finding route options…');

      try {
        const result = await queryRoutes({
          origin: originSelection,
          destination: destinationSelection,
          preference,
          accessToken: session?.accessToken,
        });

        setRouteResult(result);
        setSelectedRouteId(result.options[0]?.id ?? null);
        setStatusMessage(result.message ?? 'Select a route card to focus the map.');
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 422 && isRecord(error.details)) {
          const field =
            error.details.field === 'origin' || error.details.field === 'destination'
              ? error.details.field
              : null;
          const matches = mapDisambiguationMatches(error.details.matches);

          if (field && matches.length > 0) {
            setActiveField(field);
            setSuggestions(matches);
            setStatusMessage(error.message);
            setIsSearchingRoutes(false);
            return;
          }
        }

        setStatusMessage(
          error instanceof Error ? error.message : 'Unable to load routes right now.'
        );
      } finally {
        setIsSearchingRoutes(false);
      }
    })();
  }, [destinationSelection, originSelection, preference, session?.accessToken]);

  const selectedRoute = useMemo<RouteQueryOption | null>(
    () =>
      routeResult?.options.find((option) => option.id === selectedRouteId) ??
      routeResult?.options[0] ??
      null,
    [routeResult, selectedRouteId]
  );

  const markers = useMemo(
    () =>
      buildRouteMarkers({
        origin: originSelection,
        destination: destinationSelection,
        option: selectedRoute,
      }),
    [destinationSelection, originSelection, selectedRoute]
  );

  useEffect(() => {
    if (!mapRef.current || markers.length === 0) {
      return;
    }

    mapRef.current.fitToCoordinates(
      markers.map((marker) => ({
        latitude: marker.latitude,
        longitude: marker.longitude,
      })),
      {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      }
    );
  }, [markers]);

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    const selected =
      suggestion.source === 'google'
        ? await getGooglePlaceDetails(suggestion.googlePlaceId)
        : toSelectedPlace(suggestion);

    if (activeField === 'origin') {
      setOriginSelection(selected);
      setOriginQuery(selected.label);
    } else if (activeField === 'destination') {
      if (!originSelection) {
        const currentOrigin = await resolveCurrentOrigin();

        if (!currentOrigin) {
          return;
        }
      }

      setDestinationSelection(selected);
      setDestinationQuery(selected.label);
    }

    setActiveField(null);
    setSuggestions([]);
  };

  return (
    <SafeScreen
      backgroundColor={COLORS.surface}
      topInsetBackgroundColor="#102033"
      statusBarStyle="light"
      useGradient={true}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>Where to Sakai today?</Text>
          <Text style={styles.subtitle}>
            Sakai routeable stops are suggested first, with Google Places as fallback.
          </Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>From</Text>
              <Pressable onPress={() => void resolveCurrentOrigin()}>
                <Text style={styles.link}>Use my location</Text>
              </Pressable>
            </View>
            <TextInput
              value={originQuery}
              onChangeText={(value) => {
                setOriginQuery(value);
                setOriginSelection(null);
                setActiveField('origin');
              }}
              onFocus={() => setActiveField('origin')}
              placeholder="Current location or a stop"
              placeholderTextColor="#8191A0"
              style={styles.input}
            />

            <Text style={styles.label}>To</Text>
            <TextInput
              value={destinationQuery}
              onChangeText={(value) => {
                setDestinationQuery(value);
                setDestinationSelection(null);
                setActiveField('destination');
              }}
              onFocus={() => setActiveField('destination')}
              placeholder="Search Sakai stops or Google places"
              placeholderTextColor="#8191A0"
              style={styles.input}
            />

            <View style={styles.examples}>
              {SEARCH_EXAMPLES.map((example) => (
                <Pressable
                  key={example}
                  style={styles.exampleChip}
                  onPress={() => {
                    setDestinationQuery(example);
                    setActiveField('destination');
                  }}
                >
                  <Text style={styles.exampleText}>{example}</Text>
                </Pressable>
              ))}
            </View>

            {(loadingSuggestions || suggestions.length > 0) && (
              <View style={styles.suggestionPanel}>
                {loadingSuggestions ? <ActivityIndicator color={COLORS.primary} /> : null}
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={
                      suggestion.source === 'sakai'
                        ? suggestion.id
                        : suggestion.googlePlaceId
                    }
                    style={styles.suggestionRow}
                    onPress={() => void selectSuggestion(suggestion)}
                  >
                    <View style={styles.suggestionBody}>
                      <Text style={styles.suggestionTitle}>{suggestion.label}</Text>
                      <Text style={styles.suggestionMeta}>
                        {suggestion.source === 'sakai'
                          ? `${suggestion.city} · Sakai`
                          : suggestion.secondaryText || 'Google Maps'}
                      </Text>
                    </View>
                    <Text style={styles.suggestionSource}>
                      {suggestion.source === 'sakai' ? 'Sakai' : 'Google'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.preferenceRow}>
          {PREFERENCES.map((item) => (
            <Pressable
              key={item.value}
              style={[
                styles.preferenceChip,
                preference === item.value && styles.preferenceChipActive,
              ]}
              onPress={() => setPreference(item.value)}
            >
              <Text
                style={[
                  styles.preferenceText,
                  preference === item.value && styles.preferenceTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Map canvas</Text>
            <Text style={styles.sectionMeta}>Google Maps</Text>
          </View>
          {isGoogleMapsConfigured ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={DEFAULT_REGION}
            >
              {markers.map((marker) => (
                <Marker
                  key={marker.id}
                  coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                  pinColor={
                    marker.role === 'origin'
                      ? '#102033'
                      : marker.role === 'destination'
                        ? COLORS.primary
                        : marker.role === 'transfer'
                          ? COLORS.warning
                          : '#5D7286'
                  }
                  title={marker.title}
                  description={marker.subtitle}
                />
              ))}
            </MapView>
          ) : (
            <MapSetupNotice />
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suggested routes</Text>
          <Text style={styles.sectionMeta}>Jeepney-first</Text>
        </View>
        <View style={styles.sectionCard}>
          {isSearchingRoutes ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : null}
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>

        {routeResult?.options.map((option) => (
          <Pressable
            key={option.id}
            style={[
              styles.routeCard,
              selectedRoute?.id === option.id && styles.routeCardSelected,
            ]}
            onPress={() => setSelectedRouteId(option.id)}
          >
            <View style={styles.routeHeader}>
              <Text style={styles.routeTitle}>{option.recommendationLabel}</Text>
              <Text style={styles.routeBadge}>{option.fareConfidence}</Text>
            </View>
            <Text style={styles.routeSummary}>{option.summary}</Text>
            <Text style={styles.routeMeta}>
              {option.highlights.join(' · ') || 'Route option'}
            </Text>
            <View style={styles.stats}>
              <Text style={styles.stat}>{formatDuration(option.totalDurationMinutes)}</Text>
              <Text style={styles.stat}>{formatFare(option.totalFare)}</Text>
              <Text style={styles.stat}>
                {option.transferCount} transfer{option.transferCount === 1 ? '' : 's'}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: SPACING.xl, gap: SPACING.lg },
  hero: { backgroundColor: '#102033', padding: SPACING.lg, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg, gap: SPACING.md },
  title: { fontSize: TYPOGRAPHY.fontSizes.hero, fontFamily: FONTS.bold, color: COLORS.white },
  subtitle: { fontSize: TYPOGRAPHY.fontSizes.medium, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.72)', lineHeight: 22 },
  card: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.72)' },
  link: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.semibold, color: COLORS.white },
  input: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, fontSize: TYPOGRAPHY.fontSizes.medium, fontFamily: FONTS.medium, color: '#102033' },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  exampleChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  exampleText: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.medium, color: COLORS.white },
  suggestionPanel: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  suggestionBody: { flex: 1, gap: SPACING.xs },
  suggestionTitle: { fontSize: TYPOGRAPHY.fontSizes.medium, fontFamily: FONTS.semibold, color: '#102033' },
  suggestionMeta: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.regular, color: '#5D7286' },
  suggestionSource: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.semibold, color: COLORS.primary },
  preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.md },
  preferenceChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 999, backgroundColor: '#E8EEF3' },
  preferenceChipActive: { backgroundColor: '#102033' },
  preferenceText: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.semibold, color: '#415466' },
  preferenceTextActive: { color: COLORS.white },
  sectionCard: { marginHorizontal: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#E2EAF0', gap: SPACING.sm },
  sectionHeader: { marginHorizontal: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSizes.large, fontFamily: FONTS.bold, color: '#102033' },
  sectionMeta: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.medium, color: '#5D7286' },
  map: { width: '100%', height: 320, borderRadius: RADIUS.md },
  statusText: { fontSize: TYPOGRAPHY.fontSizes.medium, fontFamily: FONTS.regular, color: '#5D7286', lineHeight: 22 },
  routeCard: { marginHorizontal: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#E2EAF0', gap: SPACING.sm },
  routeCardSelected: { borderColor: COLORS.primary },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm, alignItems: 'center' },
  routeTitle: { flex: 1, fontSize: TYPOGRAPHY.fontSizes.medium, fontFamily: FONTS.bold, color: '#102033' },
  routeBadge: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.medium, color: COLORS.primary },
  routeSummary: { fontSize: TYPOGRAPHY.fontSizes.medium, fontFamily: FONTS.regular, color: '#5D7286', lineHeight: 22 },
  routeMeta: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.medium, color: '#415466' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  stat: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.semibold, color: '#102033' },
});
