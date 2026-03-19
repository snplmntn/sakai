import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import SafeScreen from '../components/SafeScreen';
import { hasGooglePlacesApiKey } from '../config/env';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import type { NavigationRouteCandidate, NavigationTarget } from '../navigation-alert/types';
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
const SHEET_HANDLE_HEIGHT = 34;
const SHEET_EXPANDED_RATIO = 0.68;
const SHEET_COLLAPSED_RATIO = 0.32;

type ActiveField = 'origin' | 'destination' | null;
type ResultPhase = 'idle' | 'loading' | 'ready';
type SheetSnap = 'collapsed' | 'expanded';
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

const DEMO_DESTINATION_TARGET: NavigationTarget = {
  latitude: 14.5489,
  longitude: 121.0557,
  label: 'BGC drop-off',
};

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

function DemoMapBackground() {
  return (
    <View style={styles.demoMapSurface}>
      <View style={[styles.mapWater, styles.mapWaterNorth]} />
      <View style={[styles.mapWater, styles.mapWaterSouth]} />
      <View style={[styles.mapPark, styles.mapParkWest]} />
      <View style={[styles.mapPark, styles.mapParkEast]} />

      <View style={[styles.mapRoad, styles.mapRoadA]} />
      <View style={[styles.mapRoad, styles.mapRoadB]} />
      <View style={[styles.mapRoad, styles.mapRoadC]} />
      <View style={[styles.mapRoad, styles.mapRoadD]} />
      <View style={[styles.mapRoadThin, styles.mapRoadE]} />
      <View style={[styles.mapRoadThin, styles.mapRoadF]} />
      <View style={[styles.mapRoadThin, styles.mapRoadG]} />
      <View style={[styles.mapRoadThin, styles.mapRoadH]} />

      <Svg style={styles.demoMapSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path
          d="M 16 74 C 28 71, 34 62, 44 58 S 62 49, 72 43 S 84 32, 90 27"
          stroke="#22A447"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="16" cy="74" r="3.6" fill="#FFFFFF" />
        <Circle cx="16" cy="74" r="2.2" fill="#2563EB" />
        <Circle cx="56" cy="52" r="2.8" fill="#FFFFFF" />
        <Circle cx="56" cy="52" r="1.7" fill="#8BBBEA" />
        <Circle cx="90" cy="27" r="3.8" fill="#FFFFFF" />
        <Circle cx="90" cy="27" r="2.4" fill="#F97316" />
      </Svg>

      <View style={[styles.mapLabelChip, styles.mapLabelOrigin]}>
        <Text style={styles.mapLabelText}>Espana</Text>
      </View>
      <View style={[styles.mapLabelChip, styles.mapLabelTransfer]}>
        <Text style={styles.mapLabelText}>MRT transfer</Text>
      </View>
      <View style={[styles.mapLabelChip, styles.mapLabelDestination]}>
        <Text style={styles.mapLabelText}>BGC</Text>
      </View>
    </View>
  );
}

export default function TripMapScreen() {
  const { showToast } = useToast();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Home'>>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('expanded');

  const activeQuery = activeField === 'origin' ? originQuery : destinationQuery;
  const canUseGooglePlaces = hasGooglePlacesApiKey();
  const selectedRoute =
    DEMO_ROUTE_CARDS.find((card) => card.id === selectedRouteId) ?? DEMO_ROUTE_CARDS[0] ?? null;
  const expandedSheetHeight = Math.min(
    Math.max(windowHeight * SHEET_EXPANDED_RATIO, 420),
    windowHeight - insets.top - 32
  );
  const collapsedSheetHeight = Math.min(
    Math.max(windowHeight * SHEET_COLLAPSED_RATIO, 240),
    320
  );
  const collapsedOffset = Math.max(expandedSheetHeight - collapsedSheetHeight, 0);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetTranslateValueRef = useRef(0);
  const sheetDragStartRef = useRef(0);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: resultPhase === 'idle' ? undefined : { display: 'none' },
    });

    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, resultPhase]);

  useEffect(() => {
    const listenerId = sheetTranslateY.addListener(({ value }) => {
      sheetTranslateValueRef.current = value;
    });

    return () => {
      sheetTranslateY.removeListener(listenerId);
    };
  }, [sheetTranslateY]);

  useEffect(() => {
    const targetOffset = sheetSnap === 'collapsed' ? collapsedOffset : 0;
    sheetTranslateY.setValue(targetOffset);
    sheetTranslateValueRef.current = targetOffset;
  }, [collapsedOffset, sheetSnap, sheetTranslateY]);

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

  useEffect(() => {
    if (resultPhase !== 'ready' || !selectedRoute) {
      setNavigationCandidate(null);
      return;
    }

    const nextCandidate: NavigationRouteCandidate = {
      routeId: selectedRoute.id,
      routeLabel: selectedRoute.title,
      summary: selectedRoute.summary,
      durationLabel: selectedRoute.duration,
      fareLabel: selectedRoute.fare,
      destination: DEMO_DESTINATION_TARGET,
    };

    setNavigationCandidate(nextCandidate);
  }, [resultPhase, selectedRoute, setNavigationCandidate]);

  useEffect(() => {
    if (originSelection || hasAttemptedStructuredOrigin) {
      return;
    }

    setHasAttemptedStructuredOrigin(true);
    void resolveCurrentOrigin();
  }, [hasAttemptedStructuredOrigin, originSelection]);

  const clearDemoSearchTimer = () => {
    if (!demoSearchTimerRef.current) {
      return;
    }

    clearTimeout(demoSearchTimerRef.current);
    demoSearchTimerRef.current = null;
  };

  const animateSheetTo = (nextSnap: SheetSnap) => {
    const toValue = nextSnap === 'collapsed' ? collapsedOffset : 0;
    setSheetSnap(nextSnap);

    Animated.spring(sheetTranslateY, {
      toValue,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    }).start();
  };

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          Math.abs(gestureState.dy) > 6,
        onPanResponderGrant: () => {
          sheetDragStartRef.current = sheetTranslateValueRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.min(
            Math.max(sheetDragStartRef.current + gestureState.dy, 0),
            collapsedOffset
          );
          sheetTranslateY.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentValue = Math.min(
            Math.max(sheetTranslateValueRef.current + gestureState.dy, 0),
            collapsedOffset
          );
          const shouldCollapse =
            gestureState.vy > 0.45 || currentValue > collapsedOffset / 2;

          animateSheetTo(shouldCollapse ? 'collapsed' : 'expanded');
        },
        onPanResponderTerminate: () => {
          animateSheetTo(sheetSnap);
        },
      }),
    [collapsedOffset, sheetSnap, sheetTranslateY]
  );

  const resetDemoResults = () => {
    clearDemoSearchTimer();
    setResultPhase('idle');
    setSelectedRouteId(null);
    setSheetSnap('expanded');
    setStatusMessage('Choose a routeable stop or Google place.');
    setNavigationCandidate(null);
  };

  const handleEditTrip = () => {
    resetDemoResults();
    setActiveField(null);
    setSuggestions([]);
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
    setSheetSnap('expanded');
    setSelectedRouteId(DEMO_ROUTE_CARDS[0]?.id ?? null);
    setStatusMessage('Finding route options...');
    setNavigationCandidate(null);

    demoSearchTimerRef.current = setTimeout(() => {
      setResultPhase('ready');
      setStatusMessage('Swipe down to reveal more of the map.');
      demoSearchTimerRef.current = null;
      animateSheetTo('expanded');
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

  const resetGoogleSessionToken = (field: 'origin' | 'destination') => {
    googleSessionTokensRef.current[field] = createGooglePlacesSessionToken();
  };

  useEffect(() => {
    if (!activeField || activeQuery.trim().length < 2 || resultPhase !== 'idle') {
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
  }, [activeField, activeQuery, canUseGooglePlaces, resultPhase]);

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

  if (resultPhase !== 'idle') {
    return (
      <View style={styles.resultsScreen}>
        <StatusBar style="dark" />
        <DemoMapBackground />

        <View style={[styles.topOverlayRow, { top: insets.top + SPACING.md }]}>
          <Pressable style={styles.floatingEditButton} onPress={handleEditTrip}>
            <Text style={styles.floatingEditButtonIcon}>{"←"}</Text>
            <Text style={styles.floatingEditButtonText}>Edit trip</Text>
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.bottomSheet,
            {
              height: expandedSheetHeight + insets.bottom,
              paddingBottom: insets.bottom + SPACING.md,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View {...sheetPanResponder.panHandlers} style={styles.sheetHandleZone}>
            <View style={styles.sheetHandle} />
          </View>

          {resultPhase === 'loading' ? (
            <View style={styles.loadingSheetBody}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingSheetText}>{statusMessage}</Text>
            </View>
          ) : (
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              scrollEnabled={sheetSnap === 'expanded'}
              contentContainerStyle={styles.sheetContent}
            >
              <View style={styles.sheetSectionCard}>
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

              <View style={styles.sheetSectionHeader}>
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
            </ScrollView>
          )}
        </Animated.View>
      </View>
    );
  }

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

          <View style={styles.searchCard}>
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
  searchCard: {
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
  resultsScreen: {
    flex: 1,
    backgroundColor: '#E8F0F7',
  },
  demoMapSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F0ECE2',
    overflow: 'hidden',
  },
  mapWater: {
    position: 'absolute',
    backgroundColor: '#D8EAF7',
    opacity: 0.95,
  },
  mapWaterNorth: {
    right: -24,
    top: 116,
    width: 190,
    height: 118,
    borderTopLeftRadius: 88,
    borderBottomLeftRadius: 72,
    transform: [{ rotate: '-8deg' }],
  },
  mapWaterSouth: {
    left: -28,
    bottom: 176,
    width: 220,
    height: 110,
    borderTopRightRadius: 92,
    borderBottomRightRadius: 64,
    transform: [{ rotate: '7deg' }],
  },
  mapPark: {
    position: 'absolute',
    backgroundColor: '#DDEBCF',
    opacity: 0.92,
  },
  mapParkWest: {
    left: 28,
    top: 164,
    width: 118,
    height: 86,
    borderRadius: 32,
    transform: [{ rotate: '-12deg' }],
  },
  mapParkEast: {
    right: 42,
    top: 278,
    width: 88,
    height: 68,
    borderRadius: 28,
    transform: [{ rotate: '14deg' }],
  },
  mapRoad: {
    position: 'absolute',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#D3D2CD',
  },
  mapRoadThin: {
    position: 'absolute',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#DBD9D2',
  },
  mapRoadA: {
    left: -24,
    top: 96,
    width: 260,
    transform: [{ rotate: '14deg' }],
  },
  mapRoadB: {
    right: -40,
    top: 158,
    width: 286,
    transform: [{ rotate: '-22deg' }],
  },
  mapRoadC: {
    left: -56,
    top: 286,
    width: 320,
    transform: [{ rotate: '-4deg' }],
  },
  mapRoadD: {
    right: -72,
    bottom: 268,
    width: 280,
    transform: [{ rotate: '28deg' }],
  },
  mapRoadE: {
    left: 22,
    top: 236,
    width: 168,
    transform: [{ rotate: '78deg' }],
  },
  mapRoadF: {
    right: 54,
    top: 84,
    width: 152,
    transform: [{ rotate: '92deg' }],
  },
  mapRoadG: {
    left: 104,
    bottom: 248,
    width: 196,
    transform: [{ rotate: '18deg' }],
  },
  mapRoadH: {
    right: 18,
    bottom: 170,
    width: 146,
    transform: [{ rotate: '-66deg' }],
  },
  demoMapSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLabelChip: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  mapLabelOrigin: {
    left: SPACING.lg,
    bottom: 244,
  },
  mapLabelTransfer: {
    left: 132,
    bottom: 312,
  },
  mapLabelDestination: {
    right: SPACING.lg,
    top: 166,
  },
  mapLabelText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  topOverlayRow: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 10,
  },
  floatingEditButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#DCE6F0',
  },
  floatingEditButtonIcon: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  floatingEditButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#E7EDF3',
    overflow: 'hidden',
    shadowColor: '#0B1A2B',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandleZone: {
    height: SHEET_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C8D4E0',
  },
  loadingSheetBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  loadingSheetText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#657789',
    textAlign: 'center',
    lineHeight: 22,
  },
  sheetContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  sheetSectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: SPACING.md,
  },
  sheetSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  routesMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#7890A5',
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
  routeCard: {
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
