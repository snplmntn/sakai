import { useEffect, useRef, useState } from 'react';
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

import SafeScreen from '../components/SafeScreen';
import { hasGooglePlacesApiKey } from '../config/env';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import { reverseGeocodeCurrentLocation } from '../places/api';
import {
  createGooglePlacesSessionToken,
  getPlaceSuggestionKey,
  resolvePlaceSuggestion,
  searchMergedPlaceSuggestions,
} from '../places/search';
import type { PlaceSuggestion, SakaiPlaceSuggestion, SelectedPlace } from '../places/types';
import { useToast } from '../toast/ToastContext';

const SEARCH_EXAMPLES = ['Pasay', 'Magallanes', 'Gate 3'];
const DEMO_RESULT_DELAY_MS = 450;

type ActiveField = 'origin' | 'destination' | null;
type ResultPhase = 'idle' | 'loading' | 'ready';
type SuggestedRouteCard = {
  id: string;
  eyebrow: string;
  badge: string;
  title: string;
  summary: string;
  modes: string;
  duration: string;
  fare: string;
  transfers: string;
  isDemo: boolean;
};

const DEMO_ROUTE_CARDS: SuggestedRouteCard[] = [
  {
    id: 'demo-best',
    eyebrow: 'BEST FOR YOUR PREFERENCE',
    badge: 'Estimated',
    title: 'España to BGC',
    summary: 'Jeep to MRT, then a short BGC Bus transfer with less walking near the end.',
    modes: 'Jeepney • MRT • Bus',
    duration: '52 min',
    fare: 'PHP 34',
    transfers: '2 transfers',
    isDemo: true,
  },
  {
    id: 'demo-lower-fare',
    eyebrow: 'LOWER FARE OPTION',
    badge: 'Estimated',
    title: 'España to BGC',
    summary: 'Longer jeepney segment with one transfer and a slightly longer final walk.',
    modes: 'Jeepney • Jeepney • Walk',
    duration: '61 min',
    fare: 'PHP 24',
    transfers: '1 transfer',
    isDemo: true,
  },
];

const mapDisambiguationMatches = (value: unknown): SakaiPlaceSuggestion[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const entry = item as Record<string, unknown>;

    if (
      typeof entry.id !== 'string' ||
      typeof entry.canonicalName !== 'string' ||
      typeof entry.city !== 'string' ||
      typeof entry.kind !== 'string' ||
      typeof entry.latitude !== 'number' ||
      typeof entry.longitude !== 'number' ||
      typeof entry.matchedBy !== 'string' ||
      typeof entry.matchedText !== 'string'
    ) {
      return [];
    }

    return [
      {
        source: 'sakai' as const,
        id: entry.id,
        label: entry.canonicalName,
        city: entry.city,
        kind: entry.kind as SakaiPlaceSuggestion['kind'],
        latitude: entry.latitude,
        longitude: entry.longitude,
        googlePlaceId: typeof entry.googlePlaceId === 'string' ? entry.googlePlaceId : null,
        matchedBy: entry.matchedBy as SakaiPlaceSuggestion['matchedBy'],
        matchedText: entry.matchedText,
      },
    ];
  });
};

const buildDemoSelectedPlace = (label: string): SelectedPlace => ({
  source: 'sakai',
  label,
  placeId: `demo-${label.trim().toLowerCase().replace(/\s+/gu, '-')}`,
});

export default function TripMapScreen() {
  const { showToast } = useToast();
  const { setNavigationCandidate } = useNavigationAlarm();
  const googleSessionTokensRef = useRef<Record<'origin' | 'destination', string>>({
    origin: createGooglePlacesSessionToken(),
    destination: createGooglePlacesSessionToken(),
  });
  const demoSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originSelection, setOriginSelection] = useState<SelectedPlace | null>(null);
  const [destinationSelection, setDestinationSelection] = useState<SelectedPlace | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Choose a routeable stop or Google place.');
  const [resultPhase, setResultPhase] = useState<ResultPhase>('idle');
  const [hasAttemptedStructuredOrigin, setHasAttemptedStructuredOrigin] = useState(false);

  const activeQuery = activeField === 'origin' ? originQuery : destinationQuery;
  const canUseGooglePlaces = hasGooglePlacesApiKey();

  useEffect(() => {
    setNavigationCandidate(null);

    return () => {
      if (demoSearchTimerRef.current) {
        clearTimeout(demoSearchTimerRef.current);
        demoSearchTimerRef.current = null;
      }

      setNavigationCandidate(null);
    };
  }, [setNavigationCandidate]);

  const clearDemoSearchTimer = () => {
    if (!demoSearchTimerRef.current) {
      return;
    }

    clearTimeout(demoSearchTimerRef.current);
    demoSearchTimerRef.current = null;
  };

  const resetDemoResults = () => {
    clearDemoSearchTimer();
    setResultPhase('idle');
    setSelectedRouteId(null);
    setStatusMessage('Choose a routeable stop or Google place.');
    setNavigationCandidate(null);
  };

  const resolveCurrentOrigin = async (): Promise<SelectedPlace | null> => {
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

  const ensureOriginSelection = async (): Promise<SelectedPlace> => {
    if (originSelection) {
      return originSelection;
    }

    if (originQuery.trim().length > 0) {
      const typedOrigin: SelectedPlace = {
        source: 'current-location',
        label: originQuery.trim(),
      };
      setOriginSelection(typedOrigin);
      setOriginQuery(typedOrigin.label);
      return typedOrigin;
    }

    const resolvedOrigin = await resolveCurrentOrigin();

    if (resolvedOrigin) {
      return resolvedOrigin;
    }

    const fallbackOrigin: SelectedPlace = {
      source: 'current-location',
      label: 'Current location',
    };
    setOriginSelection(fallbackOrigin);
    setOriginQuery(fallbackOrigin.label);
    return fallbackOrigin;
  };

  const startDemoSearch = () => {
    clearDemoSearchTimer();
    setResultPhase('loading');
    setSelectedRouteId(DEMO_ROUTE_CARDS[0]?.id ?? null);
    setStatusMessage('Finding route options...');
    setNavigationCandidate(null);

    demoSearchTimerRef.current = setTimeout(() => {
      setResultPhase('ready');
      setStatusMessage('Select a route card to preview the commute.');
      demoSearchTimerRef.current = null;
    }, DEMO_RESULT_DELAY_MS);
  };

  const handleSearchPress = async () => {
    const trimmedDestination = destinationQuery.trim();

    if (trimmedDestination.length === 0) {
      showToast({
        tone: 'info',
        title: 'Add a destination',
        message: 'Choose or type a destination before searching.',
      });
      return;
    }

    await ensureOriginSelection();

    const nextDestination =
      destinationSelection && destinationSelection.label.trim().length > 0
        ? destinationSelection
        : buildDemoSelectedPlace(trimmedDestination);

    setDestinationSelection(nextDestination);
    setDestinationQuery(nextDestination.label);
    setActiveField(null);
    setSuggestions([]);
    startDemoSearch();
  };

  useEffect(() => {
    if (originSelection || hasAttemptedStructuredOrigin) {
      return;
    }

    setHasAttemptedStructuredOrigin(true);
    void resolveCurrentOrigin();
  }, [hasAttemptedStructuredOrigin, originSelection]);

  const resetGoogleSessionToken = (field: 'origin' | 'destination') => {
    googleSessionTokensRef.current[field] = createGooglePlacesSessionToken();
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
  }, [activeField, activeQuery, canUseGooglePlaces]);

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
        resetDemoResults();
        setOriginSelection(selected);
        setOriginQuery(selected.label);
      } else {
        resetDemoResults();
        await ensureOriginSelection();
        setDestinationSelection(selected);
        setDestinationQuery(selected.label);
      }

      resetGoogleSessionToken(field);
      setActiveField(null);
      setSuggestions([]);
    } catch (error) {
      const details =
        error instanceof Error &&
        typeof error.cause === 'object' &&
        error.cause !== null &&
        'details' in error.cause
          ? (error.cause as { details?: unknown }).details
          : null;
      const matches = mapDisambiguationMatches(details);

      if (matches.length > 0) {
        setSuggestions(matches);
      }

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
      backgroundColor={COLORS.white}
      topInsetBackgroundColor="#102033"
      statusBarStyle="light"
      useGradient={false}
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
              <Pressable
                onPress={() => {
                  resetDemoResults();
                  void resolveCurrentOrigin();
                }}
              >
                <Text style={styles.link}>Use my location</Text>
              </Pressable>
            </View>
            <TextInput
              value={originQuery}
              onChangeText={(value) => {
                resetDemoResults();
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
                resetDemoResults();
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
                    resetDemoResults();
                    setDestinationQuery(example);
                    setDestinationSelection(buildDemoSelectedPlace(example));
                    setActiveField(null);
                    setSuggestions([]);
                  }}
                >
                  <Text style={styles.exampleText}>{example}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.searchButton} onPress={() => void handleSearchPress()}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>

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
          </View>
        </View>

        {resultPhase === 'loading' ? (
          <View style={[styles.sectionCard, styles.routeStatusCard]}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}

        {resultPhase === 'ready' ? (
          <>
            <View style={[styles.sectionCard, styles.canvasCard]}>
              <View style={styles.canvasHeader}>
                <View style={styles.canvasCopy}>
                  <Text style={styles.sectionTitle}>Map and route canvas</Text>
                  <Text style={styles.canvasSubtitle}>Google Maps drives the canvas.</Text>
                </View>
                <Text style={styles.canvasMeta}>Google Maps</Text>
              </View>
              <View style={styles.canvasRailCard}>
                <View style={styles.canvasRail}>
                  <View style={[styles.canvasDot, styles.canvasDotOrigin]} />
                  <View style={[styles.canvasTrack, styles.canvasTrackActive]} />
                  <View style={[styles.canvasDot, styles.canvasDotTransfer]} />
                  <View style={styles.canvasTrack} />
                  <View style={[styles.canvasDot, styles.canvasDotDestination]} />
                </View>
                <View style={styles.canvasLabels}>
                  <Text style={styles.canvasLabel}>Origin</Text>
                  <Text style={styles.canvasLabel}>Transfer</Text>
                  <Text style={styles.canvasLabel}>Destination</Text>
                </View>
              </View>
            </View>

            <View style={styles.routesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Suggested routes</Text>
                <Text style={styles.routesMeta}>Jeepney-first</Text>
              </View>

              {DEMO_ROUTE_CARDS.map((card) => (
                <Pressable
                  key={card.id}
                  style={[
                    styles.routeCard,
                    selectedRouteId === card.id && styles.routeCardSelected,
                  ]}
                  onPress={() => setSelectedRouteId(card.id)}
                >
                  <View style={styles.routeCardTop}>
                    <Text style={styles.routeEyebrow}>{card.eyebrow}</Text>
                    <View style={styles.routeBadge}>
                      <Text style={styles.routeBadgeText}>{card.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.routeTitle}>{card.title}</Text>
                  <Text style={styles.routeSummary}>{card.summary}</Text>
                  <Text style={styles.routeModeSummary}>{card.modes}</Text>
                  <View style={styles.routeStatsGrid}>
                    <View style={styles.routeStatCell}>
                      <Text style={styles.routeStatLabel}>Time</Text>
                      <Text style={styles.routeStatValue}>{card.duration}</Text>
                    </View>
                    <View style={styles.routeStatDivider} />
                    <View style={styles.routeStatCell}>
                      <Text style={styles.routeStatLabel}>Fare</Text>
                      <Text style={styles.routeStatValue}>{card.fare}</Text>
                    </View>
                    <View style={styles.routeStatDivider} />
                    <View style={styles.routeStatCell}>
                      <Text style={styles.routeStatLabel}>Transfers</Text>
                      <Text style={styles.routeStatValue}>{card.transfers}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SPACING.xl,
    gap: SPACING.xl,
  },
  hero: {
    backgroundColor: '#102033',
    padding: SPACING.lg,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    gap: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.hero,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.sm,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.72)',
  },
  link: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: '#102033',
  },
  examples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  exampleChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  exampleText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
  searchButton: {
    minHeight: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginTop: SPACING.xs,
  },
  searchButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  suggestionPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 6,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  suggestionBody: {
    flex: 1,
    gap: SPACING.xs,
  },
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
  sectionCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: SPACING.sm,
  },
  routeStatusCard: {
    minHeight: 76,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#657789',
    lineHeight: 22,
    textAlign: 'center',
  },
  canvasCard: {
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  canvasCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  canvasSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#7890A5',
  },
  canvasMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#7890A5',
  },
  canvasRailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE6F0',
    backgroundColor: '#F3F8FC',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  canvasRail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  canvasDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
  },
  canvasDotOrigin: {
    backgroundColor: '#102033',
  },
  canvasDotTransfer: {
    backgroundColor: '#8BBBEA',
  },
  canvasDotDestination: {
    backgroundColor: '#4A87B1',
  },
  canvasTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CFE1F0',
    marginHorizontal: SPACING.sm,
  },
  canvasTrackActive: {
    backgroundColor: '#4A87B1',
  },
  canvasLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  canvasLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#6B8297',
  },
  routesSection: {
    gap: SPACING.md,
    marginTop: -SPACING.sm,
  },
  sectionHeader: {
    marginHorizontal: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routesMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#7890A5',
  },
  routeCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: SPACING.md,
  },
  routeCardSelected: {
    borderColor: '#102033',
  },
  routeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  routeEyebrow: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: '#5C90B8',
    letterSpacing: 0.8,
  },
  routeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 2,
    borderRadius: 999,
    backgroundColor: '#EEF5FF',
  },
  routeBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#6A9BC8',
  },
  routeTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  routeSummary: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#6A7D90',
    lineHeight: 22,
  },
  routeModeSummary: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#556B80',
  },
  routeStatsGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4EBF2',
    overflow: 'hidden',
    backgroundColor: '#F7FAFD',
  },
  routeStatCell: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  routeStatDivider: {
    width: 1,
    backgroundColor: '#E4EBF2',
  },
  routeStatLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#8A9AAC',
  },
  routeStatValue: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
});
