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
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Mic01Icon } from '@hugeicons/core-free-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { ApiError, isRecord } from '../api/base';
import { useAuth } from '../auth/AuthContext';
import MapSetupNotice from '../components/MapSetupNotice';
import SafeScreen from '../components/SafeScreen';
import { hasGoogleMapsApiKey, hasGooglePlacesApiKey } from '../config/env';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { usePreferences } from '../preferences/PreferencesContext';
import { reverseGeocodeCurrentLocation } from '../places/api';
import {
  createGooglePlacesSessionToken,
  getPlaceSuggestionKey,
  resolvePlaceSuggestion,
  searchMergedPlaceSuggestions,
} from '../places/search';
import type { PlaceSuggestion, SakaiPlaceSuggestion, SelectedPlace } from '../places/types';
import { queryRoutes, queryRoutesByText } from '../routes/api';
import type { RoutePreference, RouteQueryOption, RouteQueryResult } from '../routes/types';
import {
  buildCoordinateFallbackNote,
  buildRouteMarkers,
  formatDuration,
  formatFare,
} from '../routes/view-models';
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
type SearchMode = 'structured' | 'ai';

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
  const { preferences: savedPreferences } = usePreferences();
  const { showToast } = useToast();
  const mapRef = useRef<MapView | null>(null);
  const routeSearchRequestIdRef = useRef(0);
  const googleSessionTokensRef = useRef<Record<'origin' | 'destination', string>>({
    origin: createGooglePlacesSessionToken(),
    destination: createGooglePlacesSessionToken(),
  });

  const [searchMode, setSearchMode] = useState<SearchMode>('structured');
  const [preference, setPreference] = useState<RoutePreference>('balanced');
  const [aiQuery, setAiQuery] = useState('');
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
  const {
    isListening,
    transcript,
    partialTranscript,
    error: voiceError,
    isAvailable: voiceAvailable,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput();

  const activeQuery = activeField === 'origin' ? originQuery : destinationQuery;
  const isGoogleMapsConfigured = hasGoogleMapsApiKey();
  const canUseGooglePlaces = hasGooglePlacesApiKey();
  const coordinateFallbackNote = useMemo(
    () =>
      buildCoordinateFallbackNote({
        routeResult,
        origin: originSelection,
        destination: destinationSelection,
      }),
    [destinationSelection, originSelection, routeResult]
  );

  useEffect(() => {
    setPreference(savedPreferences.defaultPreference);
  }, [savedPreferences.defaultPreference]);

  useEffect(() => {
    if (transcript.trim().length > 0) {
      setAiQuery(transcript);
      return;
    }

    if (partialTranscript.trim().length > 0) {
      setAiQuery(partialTranscript);
    }
  }, [partialTranscript, transcript]);

  const resetGoogleSessionToken = (field: 'origin' | 'destination') => {
    googleSessionTokensRef.current[field] = createGooglePlacesSessionToken();
  };

  const resolveCurrentOrigin = async () => {
    try {
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
    } catch (error) {
      showToast({
        tone: 'info',
        title: 'Location unavailable',
        message:
          error instanceof Error
            ? error.message
            : 'Choose your origin manually if location lookup is unavailable.',
      });
      return null;
    }
  };

  useEffect(() => {
    if (searchMode !== 'structured' || !activeField || activeQuery.trim().length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLoadingSuggestions(true);

        try {
          const nextSuggestions = await searchMergedPlaceSuggestions({
            query: activeQuery,
            limit: 5,
            canUseGooglePlaces,
            googleSessionToken: googleSessionTokensRef.current[activeField],
          });

          if (!cancelled) {
            setSuggestions(nextSuggestions);
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
  }, [activeField, activeQuery, canUseGooglePlaces, searchMode]);

  useEffect(() => {
    if (searchMode !== 'structured' || !originSelection || !destinationSelection) {
      return;
    }

    void (async () => {
      const requestId = routeSearchRequestIdRef.current + 1;
      routeSearchRequestIdRef.current = requestId;
      setIsSearchingRoutes(true);
      setStatusMessage('Finding route options...');

      try {
        const result = await queryRoutes({
          origin: originSelection,
          destination: destinationSelection,
          preference,
          accessToken: session?.accessToken,
        });

        if (routeSearchRequestIdRef.current !== requestId) {
          return;
        }

        setRouteResult(result);
        setSelectedRouteId(result.options[0]?.id ?? null);
        setStatusMessage(result.message ?? 'Select a route card to focus the map.');
      } catch (error) {
        if (routeSearchRequestIdRef.current !== requestId) {
          return;
        }

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

        setRouteResult(null);
        setSelectedRouteId(null);
        setStatusMessage(
          error instanceof Error ? error.message : 'Unable to load routes right now.'
        );
      } finally {
        if (routeSearchRequestIdRef.current === requestId) {
          setIsSearchingRoutes(false);
        }
      }
    })();
  }, [destinationSelection, originSelection, preference, searchMode, session?.accessToken]);

  const handleRouteQueryError = (error: unknown) => {
    if (
      error instanceof ApiError &&
      (error.statusCode === 400 || error.statusCode === 422) &&
      isRecord(error.details)
    ) {
      const field =
        error.details.field === 'origin' || error.details.field === 'destination'
          ? error.details.field
          : null;
      const matches = mapDisambiguationMatches(error.details.matches);

      if (field && matches.length > 0) {
        setSearchMode('structured');
        setActiveField(field);
        setSuggestions(matches);
        setStatusMessage(error.message);
        return true;
      }
    }

    setRouteResult(null);
    setSelectedRouteId(null);
    setStatusMessage(
      error instanceof Error ? error.message : 'Unable to load routes right now.'
    );
    return false;
  };

  const runAiRouteQuery = async () => {
    if (aiQuery.trim().length === 0) {
      return;
    }

    const requestId = routeSearchRequestIdRef.current + 1;
    routeSearchRequestIdRef.current = requestId;
    setIsSearchingRoutes(true);
    setStatusMessage('Understanding your trip and finding route options...');

    try {
      const result = await queryRoutesByText({
        queryText: aiQuery.trim(),
        preference,
        passengerType: savedPreferences.passengerType,
        accessToken: session?.accessToken,
      });

      if (routeSearchRequestIdRef.current !== requestId) {
        return;
      }

      setOriginSelection(null);
      setDestinationSelection(null);
      setRouteResult(result);
      setSelectedRouteId(result.options[0]?.id ?? null);
      setStatusMessage(result.message ?? 'Select a route card to focus the map.');
    } catch (error) {
      if (routeSearchRequestIdRef.current !== requestId) {
        return;
      }

      handleRouteQueryError(error);
    } finally {
      if (routeSearchRequestIdRef.current === requestId) {
        setIsSearchingRoutes(false);
      }
    }
  };

  const toggleVoiceCapture = async () => {
    if (isListening) {
      await stopListening();
      return;
    }

    resetTranscript();
    await startListening();
  };

  const switchSearchMode = async (mode: SearchMode) => {
    if (mode === searchMode) {
      return;
    }

    if (isListening) {
      await stopListening();
    }

    routeSearchRequestIdRef.current += 1;
    setSearchMode(mode);
    setActiveField(null);
    setSuggestions([]);
    setRouteResult(null);
    setSelectedRouteId(null);
    setIsSearchingRoutes(false);
    setStatusMessage(
      mode === 'ai'
        ? 'Describe your trip in plain language or speak it.'
        : 'Choose a routeable stop or Google place.'
    );
  };

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
    const field = activeField;

    if (!field) {
      return;
    }

    try {
      const selected = await resolvePlaceSuggestion(suggestion, {
        googleSessionToken: googleSessionTokensRef.current[field],
      });

      if (field === 'origin') {
        setOriginSelection(selected);
        setOriginQuery(selected.label);
      } else if (field === 'destination') {
        if (!originSelection) {
          await resolveCurrentOrigin();
        }

        setDestinationSelection(selected);
        setDestinationQuery(selected.label);
      }

      resetGoogleSessionToken(field);
      setActiveField(null);
      setSuggestions([]);
    } catch (error) {
      showToast({
        tone: 'info',
        title: 'Place unavailable',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to use that place right now. Try another result.',
      });
    }
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
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeChip, searchMode === 'structured' && styles.modeChipActive]}
                onPress={() => void switchSearchMode('structured')}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    searchMode === 'structured' && styles.modeChipTextActive,
                  ]}
                >
                  Map search
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeChip, searchMode === 'ai' && styles.modeChipActive]}
                onPress={() => void switchSearchMode('ai')}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    searchMode === 'ai' && styles.modeChipTextActive,
                  ]}
                >
                  Ask Sakai
                </Text>
              </Pressable>
            </View>

            {searchMode === 'structured' ? (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>From</Text>
                  <Pressable onPress={() => void resolveCurrentOrigin()}>
                    <Text style={styles.link}>Use my location</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={originQuery}
                  onChangeText={(value) => {
                    routeSearchRequestIdRef.current += 1;
                    setOriginQuery(value);
                    setOriginSelection(null);
                    setRouteResult(null);
                    setSelectedRouteId(null);
                    setIsSearchingRoutes(false);
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
                    routeSearchRequestIdRef.current += 1;
                    setDestinationQuery(value);
                    setDestinationSelection(null);
                    setRouteResult(null);
                    setSelectedRouteId(null);
                    setIsSearchingRoutes(false);
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
                        routeSearchRequestIdRef.current += 1;
                        setDestinationQuery(example);
                        setDestinationSelection(null);
                        setRouteResult(null);
                        setSelectedRouteId(null);
                        setIsSearchingRoutes(false);
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
                        key={getPlaceSuggestionKey(suggestion)}
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
              </>
            ) : (
              <View style={styles.aiCard}>
                <Text style={styles.label}>Describe your trip</Text>
                <TextInput
                  value={aiQuery}
                  onChangeText={setAiQuery}
                  placeholder="Cheapest way to Pasay from Bicutan"
                  placeholderTextColor="#8191A0"
                  style={[styles.input, styles.aiInput]}
                  multiline={true}
                />
                <View style={styles.aiActions}>
                  {voiceAvailable ? (
                    <Pressable
                      style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
                      onPress={() => void toggleVoiceCapture()}
                    >
                      <HugeiconsIcon icon={Mic01Icon} size={16} color={COLORS.white} />
                      <Text style={styles.voiceButtonText}>
                        {isListening ? 'Stop listening' : 'Speak trip'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[
                      styles.askButton,
                      aiQuery.trim().length === 0 && styles.askButtonDisabled,
                    ]}
                    disabled={aiQuery.trim().length === 0 || isSearchingRoutes}
                    onPress={() => void runAiRouteQuery()}
                  >
                    <Text style={styles.askButtonText}>Find routes</Text>
                  </Pressable>
                </View>
                {voiceError ? <Text style={styles.voiceErrorText}>{voiceError}</Text> : null}
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
          {isSearchingRoutes ? <ActivityIndicator color={COLORS.primary} /> : null}
          <Text style={styles.statusText}>{statusMessage}</Text>
          {coordinateFallbackNote ? (
            <View style={styles.fallbackNote}>
              <Text style={styles.fallbackNoteText}>{coordinateFallbackNote}</Text>
            </View>
          ) : null}
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
            {option.relevantIncidents.length > 0 ? (
              <View style={styles.incidentList}>
                <Text style={styles.incidentTitle}>Area updates</Text>
                {option.relevantIncidents.map((incident) => (
                  <Text key={incident.id} style={styles.incidentText}>
                    {incident.summary}
                  </Text>
                ))}
              </View>
            ) : null}
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
  hero: {
    backgroundColor: '#102033',
    padding: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  title: { fontSize: TYPOGRAPHY.fontSizes.hero, fontFamily: FONTS.bold, color: COLORS.white },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  modeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modeChipActive: { backgroundColor: COLORS.white },
  modeChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  modeChipTextActive: { color: '#102033' },
  label: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.72)',
  },
  link: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.semibold, color: COLORS.white },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: '#102033',
  },
  aiCard: { gap: SPACING.sm },
  aiInput: { minHeight: 88, textAlignVertical: 'top' },
  aiActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
  voiceButton: {
    flexDirection: 'row',
    gap: SPACING.xs,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  voiceButtonActive: { backgroundColor: COLORS.warning },
  voiceButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  askButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  askButtonDisabled: { opacity: 0.5 },
  askButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  voiceErrorText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#FFD2D2',
    lineHeight: 20,
  },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  exampleChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  exampleText: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.medium, color: COLORS.white },
  suggestionPanel: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, overflow: 'hidden' },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  suggestionBody: { flex: 1, gap: SPACING.xs },
  suggestionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  suggestionMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
  },
  suggestionSource: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.md },
  preferenceChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: '#E8EEF3',
  },
  preferenceChipActive: { backgroundColor: '#102033' },
  preferenceText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#415466',
  },
  preferenceTextActive: { color: COLORS.white },
  sectionCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2EAF0',
    gap: SPACING.sm,
  },
  sectionHeader: {
    marginHorizontal: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  sectionMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
  map: { width: '100%', height: 320, borderRadius: RADIUS.md },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 22,
  },
  fallbackNote: {
    borderRadius: RADIUS.md,
    backgroundColor: '#F3F8FC',
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D7E5EF',
  },
  fallbackNoteText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#415466',
    lineHeight: 20,
  },
  routeCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2EAF0',
    gap: SPACING.sm,
  },
  routeCardSelected: { borderColor: COLORS.primary },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  routeTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  routeBadge: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  routeSummary: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 22,
  },
  routeMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#415466',
  },
  incidentList: {
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFF6EC',
    borderWidth: 1,
    borderColor: '#F5D3AA',
    padding: SPACING.sm,
  },
  incidentTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: '#8A5317',
  },
  incidentText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#8A5317',
    lineHeight: 19,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  stat: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.semibold, color: '#102033' },
});
