import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  NativeModules,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Mic01Icon } from '@hugeicons/core-free-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiError } from '../api/base';
import { useAuth } from '../auth/AuthContext';
import MapSetupNotice from '../components/MapSetupNotice';
import RelevantIncidentsSection from '../components/RelevantIncidentsSection';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import SafeScreen from '../components/SafeScreen';
import { hasGoogleMapsApiKey, hasGooglePlacesApiKey } from '../config/env';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import {
  createGooglePlacesSessionToken,
  getPlaceSuggestionKey,
  resolvePlaceSuggestion,
  searchMergedPlaceSuggestions,
} from '../places/search';
import { getGoogleDirectionsPath, reverseGeocodeCurrentLocation } from '../places/api';
import { usePreferences } from '../preferences/PreferencesContext';
import {
  COMMUTE_MODE_OPTIONS,
  toggleCommuteModeSelection,
} from '../preferences/types';
import { queryRoutes, queryRoutesByText } from '../routes/api';
import {
  buildCoordinateFallbackNote,
  buildRouteMarkers,
  buildRouteSegments,
  formatDuration,
  formatFare,
} from '../routes/view-models';
import { getVoiceInputUnavailableMessage, useVoiceInput } from '../hooks/useVoiceInput';
import { transcribeSpeechRecording } from '../speech/api';
import { createFallbackSpeechTranscription } from '../speech/fallback';
import {
  getVoiceLanguageLabel,
  getVoiceRecognitionLocale,
  getVoiceTranscriptionOverride,
} from '../voice/languages';
import { extractVoiceDestinationHint, normalizeVoiceRouteQuery } from '../voice/route-query';
import type { PlaceSuggestion, SakaiPlaceSuggestion, SelectedPlace } from '../places/types';
import type {
  CommuteMode,
  PassengerType,
  RouteModifier,
  RoutePreference,
  RouteQueryLeg,
  RouteQueryOption,
  RouteQueryResult,
} from '../routes/types';

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MODE_LABELS: Record<string, string> = {
  jeepney: 'Jeep',
  uv: 'UV',
  mrt3: 'MRT3',
  lrt1: 'LRT1',
  lrt2: 'LRT2',
  tricycle: 'Tricycle',
  rail: 'Rail',
  car: 'Car',
  bus: 'Bus',
};

const MARKER_COLORS: Record<string, string> = {
  origin: COLORS.success,
  destination: COLORS.danger,
  stop: COLORS.primary,
  transfer: COLORS.warning,
};

const ROUTE_LINE_COLORS: Record<string, string> = {
  jeepney: '#007AFF',
  uv: '#34C759',
  mrt3: '#FF9500',
  lrt1: '#FF3B30',
  lrt2: '#AF52DE',
  tricycle: '#FFB000',
  rail: '#FF9500',
  car: '#102033',
  bus: '#0A84FF',
  walk: '#5D7286',
};

const SEARCH_EXAMPLES = ['Pasay', 'Magallanes', 'Gate 3'];
const SHEET_HANDLE_HEIGHT = 34;
const SHEET_EXPANDED_RATIO = 0.7;
const SHEET_COLLAPSED_RATIO = 0.34;

type AudioRecordingRef = {
  stopAndUnloadAsync: () => Promise<unknown>;
  getURI: () => string | null;
};

type ActiveField = 'origin' | 'destination' | null;
type SheetSnap = 'collapsed' | 'expanded';

const mapClarificationMatches = (value: unknown): SakaiPlaceSuggestion[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const candidate = item as Record<string, unknown>;

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.canonicalName !== 'string' ||
      typeof candidate.city !== 'string' ||
      typeof candidate.kind !== 'string' ||
      typeof candidate.latitude !== 'number' ||
      typeof candidate.longitude !== 'number' ||
      typeof candidate.matchedBy !== 'string' ||
      typeof candidate.matchedText !== 'string'
    ) {
      return [];
    }

    return [
      {
        source: 'sakai',
        id: candidate.id,
        label: candidate.canonicalName,
        city: candidate.city,
        kind: candidate.kind as SakaiPlaceSuggestion['kind'],
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        googlePlaceId:
          typeof candidate.googlePlaceId === 'string' ? candidate.googlePlaceId : null,
        matchedBy: candidate.matchedBy as SakaiPlaceSuggestion['matchedBy'],
        matchedText: candidate.matchedText,
      },
    ];
  });
};

const readClarificationState = (
  error: unknown
): {
  field: 'origin' | 'destination';
  matches: SakaiPlaceSuggestion[];
  message: string;
} | null => {
  const details =
    error instanceof ApiError
      ? error.details
      : error instanceof Error &&
          typeof error.cause === 'object' &&
          error.cause !== null &&
          'details' in error.cause
        ? (error.cause as { details?: unknown }).details
        : null;

  if (typeof details !== 'object' || details === null) {
    return null;
  }

  const detailRecord = details as Record<string, unknown>;
  const isClarification =
    detailRecord.reasonCode === 'clarification_required' ||
    Array.isArray(detailRecord.matches) ||
    Array.isArray(detailRecord.originMatches) ||
    Array.isArray(detailRecord.destinationMatches);

  if (!isClarification) {
    return null;
  }

  const field = detailRecord.field === 'origin' ? 'origin' : 'destination';
  const rawMatches = Array.isArray(detailRecord.matches)
    ? detailRecord.matches
    : field === 'origin' && Array.isArray(detailRecord.originMatches)
      ? detailRecord.originMatches
      : field === 'destination' && Array.isArray(detailRecord.destinationMatches)
        ? detailRecord.destinationMatches
        : [];
  const matches = mapClarificationMatches(rawMatches);

  if (matches.length === 0) {
    return null;
  }

  return {
    field,
    matches,
    message:
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Choose the stop cluster you meant.',
  };
};

const normalizeSakaiSelection = (
  point: RouteQueryResult['normalizedQuery']['origin'] | RouteQueryResult['normalizedQuery']['destination']
): SelectedPlace => ({
  source: 'sakai',
  label: point.label,
  placeId: point.placeId,
  latitude: point.latitude,
  longitude: point.longitude,
  matchedBy: point.matchedBy,
});

const retainPreferredSelection = (
  existing: SelectedPlace | null,
  normalized: RouteQueryResult['normalizedQuery']['origin'] | RouteQueryResult['normalizedQuery']['destination']
): SelectedPlace => {
  if (
    existing &&
    (existing.source === 'google' || existing.source === 'current-location') &&
    typeof existing.latitude === 'number' &&
    typeof existing.longitude === 'number'
  ) {
    return existing;
  }

  return normalizeSakaiSelection(normalized);
};

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LegRow({
  leg,
  optionSource,
}: {
  leg: RouteQueryLeg;
  optionSource: RouteQueryOption['source'];
}) {
  if (leg.type === 'walk') {
    return (
      <View style={styles.legRow}>
        <View style={[styles.legBadge, styles.legBadgeWalk]}>
          <Text style={styles.legBadgeText}>Walk</Text>
        </View>
        <View style={styles.legInfo}>
          <Text style={styles.legName}>Walk to {leg.toLabel}</Text>
          <Text style={styles.legMeta}>
            {leg.distanceMeters}m Â· {formatDuration(leg.durationMinutes)}
          </Text>
        </View>
      </View>
    );
  }

  if (leg.type === 'drive') {
    return (
      <View style={styles.legRow}>
        <View style={[styles.legBadge, styles.legBadgeRide]}>
          <Text style={styles.legBadgeText}>Drive</Text>
        </View>
        <View style={styles.legInfo}>
          <Text style={styles.legName}>
            {leg.fromLabel} â†’ {leg.toLabel}
          </Text>
          <Text style={styles.legMeta}>
            {leg.distanceKm.toFixed(1)} km Â· {formatDuration(leg.durationMinutes)}
          </Text>
          <Text style={styles.legFare}>
            {optionSource === 'google_fallback'
              ? 'Estimated in total only'
              : formatFare(leg.fare.amount)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.legRow}>
      <View style={[styles.legBadge, styles.legBadgeRide]}>
        <Text style={styles.legBadgeText}>{MODE_LABELS[leg.mode] ?? leg.mode}</Text>
      </View>
      <View style={styles.legInfo}>
        <Text style={styles.legName}>{leg.routeName}</Text>
        <Text style={styles.legMeta}>{leg.directionLabel}</Text>
        <Text style={styles.legMeta}>
          {leg.fromStop.stopName} â†’ {leg.toStop.stopName}
        </Text>
        <Text style={styles.legFare}>
          {optionSource === 'google_fallback'
            ? 'Estimated in total only'
            : formatFare(leg.fare.amount)}
        </Text>
      </View>
    </View>
  );
}

function RouteCard({
  option,
  compactIncidentMeta,
  selected,
  onSelect,
  expanded,
  onToggleLegs,
}: {
  option: RouteQueryOption;
  compactIncidentMeta?: string | null;
  selected: boolean;
  onSelect: () => void;
  expanded: boolean;
  onToggleLegs: () => void;
}) {
  const isEstimated =
    option.fareConfidence === 'estimated' || option.fareConfidence === 'partially_estimated';
  const fareBadgeLabel = option.fareConfidence === 'partially_estimated' ? 'Part. Est.' : 'Est. Fare';
  const isGoogleFallback = option.source === 'google_fallback';
  const primaryCommunityRoute = option.routeCommunity?.[0];

  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[styles.routeCard, selected && styles.routeCardSelected]}
      activeOpacity={0.85}
    >
      <View style={styles.routeTopRow}>
        <Text style={styles.routeEyebrow}>{option.recommendationLabel}</Text>
        {isEstimated && (
          <View style={styles.fareBadge}>
            <Text style={styles.fareBadgeText}>{fareBadgeLabel}</Text>
          </View>
        )}
      </View>

      <Text style={styles.routeSummary}>{option.summary}</Text>
      {option.providerLabel ? <Text style={styles.routeProviderLabel}>{option.providerLabel}</Text> : null}
      {option.providerNotice ? <Text style={styles.routeProviderNote}>{option.providerNotice}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Time</Text>
          <Text style={styles.statValue}>{formatDuration(option.totalDurationMinutes)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Fare</Text>
          <Text style={styles.statValue}>{formatFare(option.totalFare)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Transfers</Text>
          <Text style={styles.statValue}>{option.transferCount}</Text>
        </View>
      </View>

      {option.highlights.length > 0 && (
        <View style={styles.highlightsRow}>
          {option.highlights.map((h, i) => (
            <View key={i} style={styles.highlightChip}>
              <Text style={styles.highlightText}>{h}</Text>
            </View>
          ))}
        </View>
      )}

      {primaryCommunityRoute ? (
        <View style={styles.communityRouteCard}>
          <View style={styles.communityRouteHeader}>
            <Text style={styles.communityRouteEyebrow}>
              {primaryCommunityRoute.trustLevel === 'community_reviewed'
                ? 'Community reviewed'
                : 'Route status'}
            </Text>
            <Text style={styles.communityRouteStatus}>
              {primaryCommunityRoute.lifecycleStatus.replace(/_/g, ' ')}
            </Text>
          </View>
          {primaryCommunityRoute.activeNotes[0] ? (
            <Text style={styles.communityRouteText}>{primaryCommunityRoute.activeNotes[0].note}</Text>
          ) : null}
          {primaryCommunityRoute.recentUpdates[0] ? (
            <Text style={styles.communityRouteMeta}>
              Recent update: {primaryCommunityRoute.recentUpdates[0].summary}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!isGoogleFallback && option.relevantIncidents.length > 0 && (
        <RelevantIncidentsSection
          incidents={option.relevantIncidents}
          compact
          maxItems={1}
          metaNotice={compactIncidentMeta}
        />
      )}

      <TouchableOpacity onPress={onToggleLegs} style={styles.toggleBtn} activeOpacity={0.7}>
        <Text style={styles.toggleBtnText}>{expanded ? 'Hide breakdown' : 'Show breakdown'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.legList}>
          {!isGoogleFallback && option.relevantIncidents.length > 0 && (
            <RelevantIncidentsSection
              incidents={option.relevantIncidents}
              title="Route impact"
              metaNotice="These MMDA updates match this routeâ€™s corridor or endpoints."
            />
          )}
          {option.legs.map((leg) => (
            <LegRow key={leg.id} leg={leg} optionSource={option.source} />
          ))}
          {option.fareAssumptions.length > 0 && (
            <Text style={styles.fareNote}>* {option.fareAssumptions.join(' ')}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const buildDriveContextNote = (option: RouteQueryOption | null): string | null => {
  if (!option) {
    return null;
  }

  const messages: string[] = [];
  const firstLeg = option.legs[0];
  const lastLeg = option.legs.at(-1);

  if (firstLeg?.type === 'drive') {
    messages.push(`Starts with a car segment to ${firstLeg.toLabel}.`);
  }

  if (lastLeg?.type === 'drive') {
    messages.push(`Ends with a car segment from ${lastLeg.fromLabel} to your destination.`);
  }

  return messages.length > 0 ? messages.join(' ') : null;
};

function SuggestionRow({
  suggestion,
  onSelect,
}: {
  suggestion: PlaceSuggestion;
  onSelect: (s: PlaceSuggestion) => void;
}) {
  const isSakai = suggestion.source === 'sakai';
  const secondary = isSakai ? `${suggestion.city} Â· ${suggestion.kind}` : suggestion.secondaryText;

  return (
    <TouchableOpacity
      style={styles.suggestionRow}
      onPress={() => onSelect(suggestion)}
      activeOpacity={0.7}
    >
      <View style={[styles.suggestionIcon, isSakai ? styles.suggestionIconSakai : styles.suggestionIconGoogle]}>
        <Text style={styles.suggestionIconText}>{isSakai ? 'S' : 'G'}</Text>
      </View>
      <View style={styles.suggestionText}>
        <Text style={styles.suggestionLabel} numberOfLines={1}>
          {suggestion.label}
        </Text>
        {secondary.length > 0 && (
          <Text style={styles.suggestionSecondary} numberOfLines={1}>
            {secondary}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// â”€â”€â”€ Main screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function RoutesScreen() {
  const { session } = useAuth();
  const { preferences: savedPreferences, updatePreferences } = usePreferences();
  const { setNavigationCandidate, startNavigation } = useNavigationAlarm();
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList, 'Home'>>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [activeField, setActiveField] = useState<ActiveField>(null);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectingPlace, setSelectingPlace] = useState(false);

  const [origin, setOrigin] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [cachedCurrentOrigin, setCachedCurrentOrigin] = useState<SelectedPlace | null>(null);

  const [preference, setPreference] = useState<RoutePreference>('balanced');
  const [passengerType, setPassengerType] = useState<PassengerType>('regular');
  const [modifiers, setModifiers] = useState<RouteModifier[]>([]);
  const [commuteModes, setCommuteModes] = useState<CommuteMode[]>(
    COMMUTE_MODE_OPTIONS.map((option) => option.value)
  );
  const [allowCarAccess, setAllowCarAccess] = useState(false);

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [googleServiceNotice, setGoogleServiceNotice] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RouteQueryResult | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [mapRouteSegments, setMapRouteSegments] = useState<ReturnType<typeof buildRouteSegments>>([]);

  // Voice input
  const [voiceQuery, setVoiceQuery] = useState('');
  const [voiceTranscriptNotice, setVoiceTranscriptNotice] = useState<string | null>(null);
  const [speechPhase, setSpeechPhase] = useState<
    'idle' | 'listening' | 'finishing' | 'transcribing' | 'searching'
  >('idle');
  const [recordingAvailable, setRecordingAvailable] = useState<boolean | null>(null);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('expanded');
  const {
    isListening,
    transcript,
    partialTranscript,
    error: voiceError,
    isAvailable: voiceAvailable,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    locale: getVoiceRecognitionLocale(savedPreferences.voiceLanguage),
  });

  const mapRef = useRef<MapView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<AudioRecordingRef | null>(null);
  const finalizingRecordingRef = useRef(false);
  const directionsCacheRef = useRef<Map<string, Array<{ latitude: number; longitude: number }>>>(new Map());
  const googleSessionTokensRef = useRef<Record<'origin' | 'destination', string>>({
    origin: createGooglePlacesSessionToken(),
    destination: createGooglePlacesSessionToken(),
  });
  const hasResolvedInitialOriginRef = useRef(false);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetTranslateValueRef = useRef(0);
  const sheetDragStartRef = useRef(0);

  const activeText = activeField === 'origin' ? originText : destText;
  const accessToken = session?.accessToken;
  const isGoogleMapsConfigured = hasGoogleMapsApiKey();
  const canUseGooglePlaces = hasGooglePlacesApiKey();
  const activeRouteOptions = useMemo(() => {
    if (!routeResult) {
      return [];
    }

    return routeResult.options;
  }, [routeResult]);
  const selectedOption = activeRouteOptions.find((o) => o.id === selectedOptionId) ?? null;
  const mapMarkers = useMemo(
    () => buildRouteMarkers({ origin, destination, routeResult, option: selectedOption }),
    [destination, origin, routeResult, selectedOption]
  );
  const fallbackRouteSegments = useMemo(
    () => buildRouteSegments({ origin, destination, routeResult, option: selectedOption }),
    [destination, origin, routeResult, selectedOption]
  );
  const coordinateFallbackNote = buildCoordinateFallbackNote({
    routeResult,
    origin,
    destination,
  });
  const driveContextNote = buildDriveContextNote(selectedOption);
  const canSearch = originText.trim().length > 0 && destText.trim().length > 0;
  const voicePreviewText = partialTranscript.trim() || voiceQuery.trim();
  const voiceMicDisabled =
    speechPhase === 'finishing' || speechPhase === 'transcribing' || speechPhase === 'searching' || queryLoading;
  const voiceControlsUnavailable = !voiceAvailable;
  const voiceButtonDisabled = voiceControlsUnavailable || (voiceMicDisabled && speechPhase !== 'listening');
  const voiceStatusTitle =
    voiceControlsUnavailable
      ? 'Voice input unavailable'
      : speechPhase === 'listening'
        ? 'Listening now'
        : speechPhase === 'finishing'
          ? 'Finishing your voice request'
          : speechPhase === 'transcribing'
            ? 'Transcribing your route request'
            : speechPhase === 'searching'
              ? 'Searching from what you said'
              : 'Hold the mic to talk';
  const voiceStatusBadge =
    voiceControlsUnavailable
      ? 'Unavailable'
      : speechPhase === 'listening'
        ? 'Release to send'
        : speechPhase === 'finishing'
          ? 'Waiting for speech end'
          : speechPhase === 'idle'
            ? 'Hold to talk'
            : 'Working';
  const voiceStatusBody =
    voiceControlsUnavailable
      ? getVoiceInputUnavailableMessage()
      : speechPhase === 'listening'
        ? 'Sakai is listening. Keep holding and say your route naturally.'
        : speechPhase === 'finishing'
          ? 'You let go. Sakai will detect the end of speech, then send your request.'
          : speechPhase === 'transcribing'
            ? 'Turning your speech into a route request with multilingual transcription.'
            : speechPhase === 'searching'
              ? 'Matching your spoken request to route data and your saved commute preferences.'
              : 'Say things like "BGC fastest route" or "Gate 3 from Espana."';
  const showResultsCanvas = queryLoading || routeResult !== null;
  const selectedRoute = selectedOption ?? activeRouteOptions[0] ?? null;
  const expandedSheetHeight = Math.min(
    Math.max(windowHeight * SHEET_EXPANDED_RATIO, 420),
    windowHeight - insets.top - 24
  );
  const collapsedSheetHeight = Math.min(
    Math.max(windowHeight * SHEET_COLLAPSED_RATIO, 240),
    330
  );
  const collapsedOffset = Math.max(expandedSheetHeight - collapsedSheetHeight, 0);

  useEffect(() => {
    setRecordingAvailable(Boolean(NativeModules.ExponentAV));
  }, []);

  const resetGoogleSessionToken = useCallback((field: 'origin' | 'destination') => {
    googleSessionTokensRef.current[field] = createGooglePlacesSessionToken();
  }, []);

  const resetRoutePresentation = useCallback(() => {
    setRouteResult(null);
    setSelectedOptionId(null);
    setExpandedOptions(new Set());
    setMapRouteSegments([]);
    setGoogleServiceNotice(null);
    setQueryError(null);
    setSheetSnap('expanded');
  }, []);

  const applyStructuredResult = useCallback(
    (
      result: RouteQueryResult,
      nextOrigin: SelectedPlace | null,
      nextDestination: SelectedPlace | null
    ) => {
      const resolvedOrigin = retainPreferredSelection(nextOrigin, result.normalizedQuery.origin);
      const resolvedDestination = retainPreferredSelection(
        nextDestination,
        result.normalizedQuery.destination
      );
      const initialOption = result.options[0] ?? null;

      setOrigin(resolvedOrigin);
      setDestination(resolvedDestination);
      setOriginText(resolvedOrigin.label);
      setDestText(resolvedDestination.label);
      setRouteResult(result);
      setSelectedOptionId(initialOption?.id ?? null);
      setExpandedOptions(initialOption ? new Set([initialOption.id]) : new Set());
      setActiveField(null);
      setSuggestions([]);
      setSheetSnap('expanded');
    },
    []
  );

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: showResultsCanvas ? { display: 'none' } : undefined,
    });

    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, showResultsCanvas]);

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

  const animateSheetTo = useCallback(
    (nextSnap: SheetSnap) => {
      const toValue = nextSnap === 'collapsed' ? collapsedOffset : 0;
      setSheetSnap(nextSnap);

      Animated.spring(sheetTranslateY, {
        toValue,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
      }).start();
    },
    [collapsedOffset, sheetTranslateY]
  );

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
    [animateSheetTo, collapsedOffset, sheetSnap, sheetTranslateY]
  );

  // â”€â”€ Debounced suggestion fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    setPreference(savedPreferences.defaultPreference);
    setPassengerType(savedPreferences.passengerType);
    setModifiers(savedPreferences.routeModifiers);
    setCommuteModes(savedPreferences.commuteModes);
    setAllowCarAccess(savedPreferences.allowCarAccess);
  }, [
    savedPreferences.defaultPreference,
    savedPreferences.passengerType,
    savedPreferences.routeModifiers,
    savedPreferences.commuteModes,
    savedPreferences.allowCarAccess,
  ]);

  const persistRoutePreferences = useCallback(
    async (overrides: { commuteModes?: CommuteMode[]; allowCarAccess?: boolean }) => {
      await updatePreferences({
        defaultPreference: preference,
        passengerType,
        routeModifiers: modifiers,
        voiceLanguage: savedPreferences.voiceLanguage,
        commuteModes: overrides.commuteModes ?? commuteModes,
        allowCarAccess: overrides.allowCarAccess ?? allowCarAccess,
      });
    },
    [
      allowCarAccess,
      commuteModes,
      modifiers,
      passengerType,
      preference,
      savedPreferences.voiceLanguage,
      updatePreferences,
    ]
  );

  const handleCommuteModeChipPress = useCallback(
    (commuteMode: CommuteMode) => {
      const nextCommuteModes = toggleCommuteModeSelection(commuteModes, commuteMode);

      if (nextCommuteModes === commuteModes) {
        return;
      }

      setCommuteModes(nextCommuteModes);
      void persistRoutePreferences({ commuteModes: nextCommuteModes }).catch((error: unknown) => {
        console.warn('Unable to persist commute mode preferences from routes screen', error);
      });
    },
    [commuteModes, persistRoutePreferences]
  );

  const handleCarAccessChipPress = useCallback(() => {
    const nextAllowCarAccess = !allowCarAccess;

    setAllowCarAccess(nextAllowCarAccess);
    void persistRoutePreferences({ allowCarAccess: nextAllowCarAccess }).catch((error: unknown) => {
      console.warn('Unable to persist car access preference from routes screen', error);
    });
  }, [allowCarAccess, persistRoutePreferences]);

  useEffect(() => {
    if (!activeField) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const query = activeText.trim();

    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        setSuggestions(
          await searchMergedPlaceSuggestions({
            query,
            limit: 5,
            canUseGooglePlaces,
            googleSessionToken: googleSessionTokensRef.current[activeField],
          })
        );
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeField, activeText, canUseGooglePlaces]);

  // â”€â”€ Sync transcript â†’ voiceQuery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (transcript.trim().length > 0) {
      setVoiceQuery(transcript);
    }
  }, [transcript]);

  // â”€â”€ Map fit after result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (!routeResult || !selectedOptionId) return;
    const coords = [
      ...mapMarkers.map((marker) => ({ latitude: marker.latitude, longitude: marker.longitude })),
      ...mapRouteSegments.flatMap((segment) => segment.coordinates),
    ];

    if (coords.length < 2) return;

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }, 300);
  }, [mapMarkers, mapRouteSegments, routeResult, selectedOptionId]);

  useEffect(() => {
    setMapRouteSegments(fallbackRouteSegments);
    setGoogleServiceNotice(null);

    if (!isGoogleMapsConfigured || fallbackRouteSegments.length === 0) {
      return;
    }

    const needsDirections = fallbackRouteSegments.some(
      (segment) => (segment.type === 'walk' || segment.type === 'drive') && segment.coordinates.length >= 2
    );

    if (!needsDirections) {
      return;
    }

    let cancelled = false;

    const hydrateRouteSegments = async () => {
      let hasDirectionFailure = false;

      const resolvedSegments = await Promise.all(
        fallbackRouteSegments.map(async (segment) => {
          if ((segment.type !== 'walk' && segment.type !== 'drive') || segment.coordinates.length < 2) {
            return segment;
          }

          const [originCoordinate, destinationCoordinate] = segment.coordinates;
          const cacheKey = [
            segment.type,
            originCoordinate.latitude,
            originCoordinate.longitude,
            destinationCoordinate.latitude,
            destinationCoordinate.longitude,
          ].join(':');
          const cachedPath = directionsCacheRef.current.get(cacheKey);

          if (cachedPath) {
            return {
              ...segment,
              coordinates: cachedPath,
              isFallbackGeometry: false,
            };
          }

          try {
            const googlePath = await getGoogleDirectionsPath({
              origin: originCoordinate,
              destination: destinationCoordinate,
              mode: segment.type === 'walk' ? 'walking' : 'driving',
            });

            if (!googlePath || googlePath.length < 2) {
              hasDirectionFailure = true;
              return segment;
            }

            directionsCacheRef.current.set(cacheKey, googlePath);

            return {
              ...segment,
              coordinates: googlePath,
              isFallbackGeometry: false,
            };
          } catch {
            hasDirectionFailure = true;
            return segment;
          }
        })
      );

      if (cancelled) {
        return;
      }

      setMapRouteSegments(resolvedSegments);

      if (hasDirectionFailure) {
        setGoogleServiceNotice(
          'Some walk or car map paths are shown as straight lines because Google Directions is unavailable right now.'
        );
      }
    };

    void hydrateRouteSegments();

    return () => {
      cancelled = true;
    };
  }, [fallbackRouteSegments, isGoogleMapsConfigured]);

  const resolveCurrentOrigin = useCallback(async (assignToOrigin: boolean) => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationNotice('Location access is off. Choose your origin manually to search routes.');
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const place = await reverseGeocodeCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      setCachedCurrentOrigin(place);
      setLocationNotice(null);

      if (assignToOrigin) {
        resetRoutePresentation();
        setOrigin(place);
        setOriginText(place.label);
        setActiveField(null);
        setSuggestions([]);
      }

      return place;
    } catch (error) {
      setLocationNotice(
        error instanceof Error
          ? error.message
          : 'Current location could not be loaded. Choose your origin manually.'
      );
      return null;
    }
  }, [resetRoutePresentation]);

  const runVoiceSearch = useCallback(
    async (spokenQuery: string, originFallback?: SelectedPlace | null) => {
      const normalizedQuery = normalizeVoiceRouteQuery(spokenQuery);

      if (normalizedQuery.length === 0) {
        throw new Error('No route request was detected. Try saying your destination again.');
      }

      setVoiceQuery(normalizedQuery);
      setVoiceTranscriptNotice(null);
      const destinationHint = extractVoiceDestinationHint(normalizedQuery);
      if (destinationHint.length > 0) {
        setDestText(destinationHint);
        setDestination(null);
      }

      setQueryLoading(true);
      resetRoutePresentation();
      setSpeechPhase('searching');

      try {
        const result = await queryRoutesByText({
          queryText: normalizedQuery,
          originFallback: originFallback ?? undefined,
          preference,
          passengerType,
          modifiers,
          commuteModes,
          allowCarAccess,
          accessToken,
        });

        applyStructuredResult(result, originFallback ?? null, destination);
      } catch (error) {
        const clarificationState = readClarificationState(error);

        if (clarificationState) {
          setQueryError(clarificationState.message);
          setSuggestions(clarificationState.matches);
          setActiveField(clarificationState.field);
          return;
        }

        throw error;
      } finally {
        setQueryLoading(false);
        setSpeechPhase('idle');
      }
    },
    [
      accessToken,
      allowCarAccess,
      applyStructuredResult,
      commuteModes,
      destination,
      modifiers,
      passengerType,
      preference,
      resetRoutePresentation,
    ]
  );

  const finalizeRecordingAndSearch = useCallback(async () => {
    if (finalizingRecordingRef.current) {
      return;
    }

    finalizingRecordingRef.current = true;

    try {
      const recording = recordingRef.current;
      recordingRef.current = null;

      if (!recording) {
        const fallbackOrigin =
          origin ?? cachedCurrentOrigin ?? (await resolveCurrentOrigin(false));
        if (fallbackOrigin) {
          setOrigin(fallbackOrigin);
          setOriginText(fallbackOrigin.label);
        }

        await runVoiceSearch(transcript, fallbackOrigin);
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error('Voice recording could not be saved. Try again.');
      }

      setSpeechPhase('transcribing');
      const speechResult = await transcribeSpeechRecording({
        uri,
        mimeType: 'audio/aac',
        accessToken,
        languageOverride: getVoiceTranscriptionOverride(savedPreferences.voiceLanguage),
      }).catch((error: unknown) => {
        const fallbackTranscript = transcript.trim();

        if (fallbackTranscript.length === 0) {
          throw error;
        }

        setVoiceTranscriptNotice(
          'Using the device transcript because multilingual server transcription is unavailable right now.'
        );

        return createFallbackSpeechTranscription({
          transcript: fallbackTranscript,
          voiceLanguage: savedPreferences.voiceLanguage,
        });
      });
      setVoiceQuery(speechResult.transcript);
      const fallbackOrigin =
        origin ?? cachedCurrentOrigin ?? (await resolveCurrentOrigin(false));
      if (fallbackOrigin) {
        setOrigin(fallbackOrigin);
        setOriginText(fallbackOrigin.label);
      }

      await runVoiceSearch(
        speechResult.transcript.trim().length > 0 ? speechResult.transcript : transcript,
        fallbackOrigin
      );
    } finally {
      finalizingRecordingRef.current = false;
    }
  }, [
    accessToken,
    cachedCurrentOrigin,
    origin,
    resolveCurrentOrigin,
    runVoiceSearch,
    savedPreferences.voiceLanguage,
    transcript,
  ]);

  const startSpeechCapture = useCallback(async () => {
    if (speechPhase !== 'idle') {
      return;
    }

    if (!voiceAvailable) {
      setQueryError(voiceError ?? getVoiceInputUnavailableMessage());
      return;
    }

    try {
      setActiveField(null);
      setSuggestions([]);
      setQueryError(null);
      setVoiceTranscriptNotice(null);
      resetTranscript();
      setVoiceQuery('');
      setSpeechPhase('listening');

      if (recordingAvailable) {
        const expoAv = await import('expo-av');
        const permission = await expoAv.Audio.requestPermissionsAsync();

        if (!permission.granted) {
          setSpeechPhase('idle');
          setQueryError('Microphone access is off. Allow microphone access to speak your route.');
          return;
        }

        await expoAv.Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: expoAv.InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: expoAv.InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });

        const { recording } = await expoAv.Audio.Recording.createAsync(
          expoAv.Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
      }

      await startListening();
    } catch (error) {
      const recording = recordingRef.current;
      recordingRef.current = null;
      if (recording) {
        await recording.stopAndUnloadAsync().catch(() => undefined);
      }
      setSpeechPhase('idle');
      setQueryError(
        error instanceof Error ? error.message : 'Unable to start voice capture right now.'
      );
    }
  }, [recordingAvailable, resetTranscript, speechPhase, startListening, voiceAvailable, voiceError]);

  const stopSpeechCapture = useCallback(async () => {
    if (speechPhase !== 'listening') {
      return;
    }

    setSpeechPhase('finishing');

    try {
      await stopListening();
    } catch (error) {
      setSpeechPhase('idle');
      setQueryError(error instanceof Error ? error.message : 'Unable to finish voice capture.');
    }
  }, [speechPhase, stopListening]);

  useEffect(() => {
    if (origin !== null || hasResolvedInitialOriginRef.current) {
      return;
    }

    hasResolvedInitialOriginRef.current = true;
    void resolveCurrentOrigin(true);
  }, [origin, resolveCurrentOrigin]);

  useEffect(() => {
    if (
      (speechPhase !== 'listening' && speechPhase !== 'finishing') ||
      isListening ||
      !recordingRef.current
    ) {
      return;
    }

    void finalizeRecordingAndSearch();
  }, [finalizeRecordingAndSearch, isListening, speechPhase]);

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleSuggestionSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const field = activeField;

      if (!field) {
        return;
      }

      setSelectingPlace(true);
      setQueryError(null);
      try {
        const resolved = await resolvePlaceSuggestion(suggestion, {
          googleSessionToken: googleSessionTokensRef.current[field],
        });

        resetRoutePresentation();

        if (field === 'origin') {
          setOrigin(resolved);
          setOriginText(resolved.label);
          setLocationNotice(null);
        } else {
          setDestination(resolved);
          setDestText(resolved.label);
        }

        resetGoogleSessionToken(field);
        setActiveField(null);
        setSuggestions([]);
      } catch (error) {
        const clarificationState = readClarificationState(error);

        if (clarificationState) {
          setSuggestions(clarificationState.matches);
          setActiveField(clarificationState.field);
          setQueryError(clarificationState.message);
        } else {
          setQueryError(
            error instanceof Error
              ? error.message
              : 'Unable to load that place right now. Try another result.'
          );
        }
      } finally {
        setSelectingPlace(false);
      }
    },
    [activeField, resetGoogleSessionToken, resetRoutePresentation]
  );

  const handleSearch = useCallback(async () => {
    if (queryLoading || !canSearch) return;
    const selectedOrigin = origin;
    const selectedDestination = destination;

    setQueryLoading(true);
    setQueryError(null);
    setSuggestions([]);
    try {
      const result = await queryRoutes({
        origin: selectedOrigin ?? { label: originText.trim() },
        destination: selectedDestination ?? { label: destText.trim() },
        preference,
        passengerType,
        modifiers,
        commuteModes,
        allowCarAccess,
        accessToken,
      });

      applyStructuredResult(result, selectedOrigin, selectedDestination);
    } catch (err: unknown) {
      const clarificationState = readClarificationState(err);

      if (clarificationState) {
        setSuggestions(clarificationState.matches);
        setActiveField(clarificationState.field);
        setQueryError(clarificationState.message);
        return;
      }

      setQueryError(err instanceof Error ? err.message : 'Route search failed. Try again.');
    } finally {
      setQueryLoading(false);
    }
  }, [
    accessToken,
    allowCarAccess,
    applyStructuredResult,
    cachedCurrentOrigin,
    canSearch,
    commuteModes,
    destination,
    destText,
    modifiers,
    origin,
    originText,
    passengerType,
    preference,
    queryLoading,
  ]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearField = useCallback((field: 'origin' | 'destination') => {
    resetRoutePresentation();

    if (field === 'origin') {
      setOrigin(null);
      setOriginText('');
      setLocationNotice(null);
    } else {
      setDestination(null);
      setDestText('');
    }

    setSuggestions([]);
    setActiveField(field);
  }, [resetRoutePresentation]);

  const handleSwapLocations = useCallback(() => {
    const nextOriginText = destText;
    const nextDestText = originText;
    const nextOrigin = destination;
    const nextDestination = origin;

    setOriginText(nextOriginText);
    setDestText(nextDestText);
    setOrigin(nextOrigin);
    setDestination(nextDestination);
    setActiveField(null);
    setSuggestions([]);
    resetRoutePresentation();

    if (nextOrigin !== null && nextDestination !== null) {
      setTimeout(() => {
        void (async () => {
          setQueryLoading(true);
          try {
            const result = await queryRoutes({
              origin: nextOrigin,
              destination: nextDestination,
              preference,
              passengerType,
              modifiers,
              commuteModes,
              allowCarAccess,
              accessToken,
            });
            applyStructuredResult(result, nextOrigin, nextDestination);
          } catch (error) {
            setQueryError(error instanceof Error ? error.message : 'Route search failed. Try again.');
          } finally {
            setQueryLoading(false);
          }
        })();
      }, 0);
    }
  }, [
    accessToken,
    allowCarAccess,
    applyStructuredResult,
    destText,
    destination,
    commuteModes,
    modifiers,
    origin,
    originText,
    passengerType,
    preference,
    resetRoutePresentation,
  ]);

  const handleLocatePress = useCallback(async () => {
    if (cachedCurrentOrigin) {
      resetRoutePresentation();
      setOrigin(cachedCurrentOrigin);
      setOriginText(cachedCurrentOrigin.label);
      setActiveField(null);
      setSuggestions([]);
      setLocationNotice(null);
      return;
    }

    await resolveCurrentOrigin(true);
  }, [cachedCurrentOrigin, resetRoutePresentation, resolveCurrentOrigin]);

  const handleExamplePress = useCallback((example: string) => {
    resetRoutePresentation();
    setDestText(example);
    setDestination(null);
    setActiveField('destination');
    setSuggestions([]);
  }, [resetRoutePresentation]);

  const renderSuggestionPanel = () => {
    if (!activeField) {
      return null;
    }

    return (
      <View style={styles.suggestionPanel}>
        {suggestionsLoading || selectingPlace ? (
          <View style={styles.suggestionsSpinner}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.suggestionsSpinnerText}>
              {selectingPlace ? 'Getting location...' : 'Searching...'}
            </Text>
          </View>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion) => (
            <SuggestionRow
              key={getPlaceSuggestionKey(suggestion)}
              suggestion={suggestion}
              onSelect={handleSuggestionSelect}
            />
          ))
        ) : (
          <Text style={styles.noResults}>
            {activeText.trim().length >= 2 ? 'No results' : 'Type to search'}
          </Text>
        )}
      </View>
    );
  };

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (!selectedRoute) {
      setNavigationCandidate(null);
      return;
    }

    setNavigationCandidate({
      routeId: selectedRoute.id,
      routeLabel: selectedRoute.recommendationLabel,
      summary: selectedRoute.summary,
      durationLabel: formatDuration(selectedRoute.totalDurationMinutes),
      fareLabel: formatFare(selectedRoute.totalFare),
      originLabel: (routeResult?.normalizedQuery.origin.label ?? originText) || 'Origin',
      destinationLabel:
        (routeResult?.normalizedQuery.destination.label ?? destText) || 'Destination',
      corridorTags: selectedRoute.corridorTags,
      relevantIncidents: selectedRoute.relevantIncidents,
      destination: selectedRoute.navigationTarget,
    });
  }, [
    destText,
    originText,
    routeResult?.normalizedQuery.destination.label,
    routeResult?.normalizedQuery.origin.label,
    selectedRoute,
    setNavigationCandidate,
  ]);

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (showResultsCanvas) {
    return (
      <View style={styles.resultsScreen}>
        <StatusBar style="dark" />
        {isGoogleMapsConfigured ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: 14.5995,
              longitude: 120.9842,
              latitudeDelta: 0.2,
              longitudeDelta: 0.2,
            }}
          >
            {mapRouteSegments.map((segment) => (
              <Polyline
                key={segment.id}
                coordinates={segment.coordinates}
                strokeColor={ROUTE_LINE_COLORS[segment.mode] ?? COLORS.primary}
                strokeWidth={segment.type === 'ride' ? 5 : 4}
                lineDashPattern={segment.type === 'walk' ? [8, 6] : undefined}
              />
            ))}
            {mapMarkers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={marker.title}
                description={marker.subtitle}
                pinColor={MARKER_COLORS[marker.role] ?? COLORS.primary}
              />
            ))}
          </MapView>
        ) : (
          <MapSetupNotice compact />
        )}

        <View style={[styles.topOverlayRow, { top: insets.top + SPACING.md }]}>
          <Pressable
            style={styles.floatingEditButton}
            onPress={() => {
              setSpeechPhase('idle');
              setRouteResult(null);
              setQueryLoading(false);
              setSheetSnap('expanded');
            }}
          >
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

          {queryLoading ? (
            <View style={styles.loadingSheetBody}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingSheetText}>Finding route options...</Text>
              <Text style={styles.loadingSheetSubtext}>
                Matching your origin, destination, and saved commute preferences.
              </Text>
            </View>
          ) : (
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              scrollEnabled={sheetSnap === 'expanded'}
              contentContainerStyle={styles.sheetContent}
            >
              <View style={styles.tripSummaryCard}>
                <Text style={styles.tripSummaryEyebrow}>Current trip</Text>
                <Text style={styles.tripSummaryTitle}>
                  {originText || 'Origin'} to {destText || 'Destination'}
                </Text>
                <Text style={styles.tripSummaryBody}>
                  Tap a route below to compare jeepney-first options and fallback directions.
                </Text>
              </View>

              {queryError ? (
                <View style={styles.messageCard}>
                  <Text style={styles.errorText}>{queryError}</Text>
                </View>
              ) : null}

              {locationNotice ? (
                <View style={styles.messageCard}>
                  <Text style={styles.fallbackNoteText}>{locationNotice}</Text>
                </View>
              ) : null}

              {googleServiceNotice ? (
                <View style={styles.messageCard}>
                  <Text style={styles.fallbackNoteText}>{googleServiceNotice}</Text>
                </View>
              ) : null}

              {coordinateFallbackNote || driveContextNote ? (
                <View style={styles.messageCard}>
                  {coordinateFallbackNote ? (
                    <Text style={styles.fallbackNoteText}>{coordinateFallbackNote}</Text>
                  ) : null}
                  {driveContextNote ? (
                    <Text style={styles.fallbackNoteText}>{driveContextNote}</Text>
                  ) : null}
                </View>
              ) : null}

              {routeResult &&
              routeResult.options.length === 0 &&
              routeResult.googleFallback.options.length === 0 &&
              routeResult.message ? (
                <View style={styles.messageCard}>
                  <Text style={styles.messageText}>{routeResult.message}</Text>
                </View>
              ) : null}

              {routeResult &&
              routeResult.options.length === 0 &&
              routeResult.googleFallback.options.length === 0 &&
              routeResult.googleFallback.message ? (
                <View style={styles.messageCard}>
                  <Text style={styles.messageText}>{routeResult.googleFallback.message}</Text>
                </View>
              ) : null}

              {routeResult?.options.length ? (
                <>
                  <View style={styles.sheetSectionHeader}>
                    <Text style={styles.sheetSectionTitle}>Routes</Text>
                    <Text style={styles.sheetSectionMeta}>
                      {routeResult.options.some((option) => option.source === 'google_fallback')
                        ? routeResult.options.some((option) => option.source === 'sakai')
                          ? 'Sakai + fallback'
                          : 'Google fallback'
                        : 'Jeepney-first'}
                    </Text>
                  </View>
                  {routeResult.options.map((option) => (
                    <View key={option.id} style={styles.routeCardGroup}>
                      <RouteCard
                        option={option}
                        compactIncidentMeta="Shown because this route may be affected."
                        selected={option.id === selectedOptionId}
                        onSelect={() => setSelectedOptionId(option.id)}
                        expanded={expandedOptions.has(option.id)}
                        onToggleLegs={() => toggleExpanded(option.id)}
                      />
                      {option.id === selectedOptionId ? (
                        <TouchableOpacity
                          style={styles.primaryActionButton}
                          onPress={() => {
                            void startNavigation();
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.primaryActionButtonText}>Start route</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}

            </ScrollView>
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeScreen
      backgroundColor={COLORS.surface}
      topInsetBackgroundColor="#102033"
      statusBarStyle="light"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* â”€â”€ Hero card â”€â”€ */}
          <View style={styles.heroCard}>
            <View style={styles.heroRule} />
            <View style={styles.heroTopRow}>
              <Text style={styles.heroLabel}>Routes</Text>
              <TouchableOpacity
                style={[
                  styles.heroMicButton,
                  speechPhase === 'listening' && styles.heroMicButtonActive,
                  voiceButtonDisabled && styles.heroMicButtonDisabled,
                ]}
                onPress={() => {
                  if (!voiceAvailable) {
                    return;
                  }

                  if (speechPhase === 'idle') {
                    void startSpeechCapture();
                    return;
                  }

                  if (speechPhase === 'listening') {
                    void stopSpeechCapture();
                  }
                }}
                activeOpacity={0.85}
                disabled={voiceButtonDisabled}
              >
                <HugeiconsIcon icon={Mic01Icon} size={16} color={COLORS.white} />
                <Text style={styles.heroMicButtonText}>
                  {voiceAvailable ? (speechPhase === 'listening' ? 'Stop' : 'Voice') : 'Voice off'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.heroTitle}>Where to Sakai today?</Text>

            <View style={styles.searchCard}>
              <>
                {/* From */}
                <View style={[styles.searchField, activeField === 'origin' && styles.searchFieldActive]}>
                  <Text style={styles.searchFieldLabel}>From</Text>
                  <View style={styles.fieldHeaderActions}>
                    <Pressable style={styles.inlineActionButton} onPress={() => void handleLocatePress()}>
                      <Text style={styles.inlineActionText}>Locate</Text>
                    </Pressable>
                    <Pressable style={styles.inlineActionButton} onPress={handleSwapLocations}>
                      <Text style={styles.inlineActionText}>Reverse</Text>
                    </Pressable>
                  </View>
                </View>
                <View
                  style={[
                    styles.searchField,
                    styles.searchInputRow,
                    activeField === 'origin' && styles.searchFieldActive,
                  ]}
                >
                  <TextInput
                    style={styles.searchInput}
                    value={originText}
                    onChangeText={(text) => {
                      resetRoutePresentation();
                      setOriginText(text);
                      if (origin) setOrigin(null);
                      setActiveField('origin');
                      setSuggestions([]);
                    }}
                    onFocus={() => setActiveField('origin')}
                    placeholder="Current location or a stop"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    returnKeyType="next"
                  />
                  {originText.length > 0 && (
                    <TouchableOpacity
                      onPress={() => clearField('origin')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.clearBtn}>x</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeField === 'origin' && (
                  <View style={styles.inlineSuggestionsCard}>
                    {suggestionsLoading || selectingPlace ? (
                      <View style={styles.suggestionsSpinner}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.suggestionsSpinnerText}>
                          {selectingPlace ? 'Getting location...' : 'Searching...'}
                        </Text>
                      </View>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((s) => (
                        <SuggestionRow
                          key={getPlaceSuggestionKey(s)}
                          suggestion={s}
                          onSelect={handleSuggestionSelect}
                        />
                      ))
                    ) : (
                      <Text style={styles.noResults}>
                        {activeText.trim().length >= 2 ? 'No results' : 'Type to search'}
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.fieldDivider} />

                {/* To */}
                <View
                  style={[styles.searchField, activeField === 'destination' && styles.searchFieldActive]}
                >
                  <Text style={styles.searchFieldLabel}>To</Text>
                  <Text style={styles.searchFieldHint}>
                    {voiceAvailable ? 'Hold mic to talk' : 'Mic unavailable'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.searchField,
                    activeField === 'destination' && styles.searchFieldActive,
                  ]}
                >
                  <TextInput
                    style={styles.searchInput}
                    value={destText}
                    onChangeText={(text) => {
                      resetRoutePresentation();
                      setDestText(text);
                      if (destination) setDestination(null);
                      setActiveField('destination');
                      setSuggestions([]);
                    }}
                    onFocus={() => setActiveField('destination')}
                    placeholder="Destination"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    returnKeyType="search"
                    onSubmitEditing={canSearch ? handleSearch : undefined}
                  />
                  <View style={styles.destinationActions}>
                    {destText.length > 0 && speechPhase === 'idle' ? (
                      <TouchableOpacity
                        onPress={() => clearField('destination')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.clearBtn}>x</Text>
                      </TouchableOpacity>
                    ) : null}
                    <Pressable
                      style={[
                        styles.voiceHoldButton,
                        speechPhase === 'listening' && styles.voiceHoldButtonActive,
                        voiceMicDisabled && !voiceControlsUnavailable && styles.voiceHoldButtonBusy,
                        voiceControlsUnavailable && styles.voiceHoldButtonDisabled,
                      ]}
                      onPressIn={() => {
                        if (!voiceAvailable) {
                          return;
                        }
                        void startSpeechCapture();
                      }}
                      onPressOut={() => {
                        if (!voiceAvailable) {
                          return;
                        }
                        void stopSpeechCapture();
                      }}
                      disabled={voiceControlsUnavailable || voiceMicDisabled}
                    >
                      <HugeiconsIcon
                        icon={Mic01Icon}
                        size={18}
                        color={voiceControlsUnavailable ? 'rgba(255,255,255,0.72)' : COLORS.white}
                      />
                    </Pressable>
                  </View>
                </View>

                {activeField === 'destination' && (
                  <View style={styles.inlineSuggestionsCard}>
                    {suggestionsLoading || selectingPlace ? (
                      <View style={styles.suggestionsSpinner}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.suggestionsSpinnerText}>
                          {selectingPlace ? 'Getting location...' : 'Searching...'}
                        </Text>
                      </View>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((s) => (
                        <SuggestionRow
                          key={getPlaceSuggestionKey(s)}
                          suggestion={s}
                          onSelect={handleSuggestionSelect}
                        />
                      ))
                    ) : (
                      <Text style={styles.noResults}>
                        {activeText.trim().length >= 2 ? 'No results' : 'Type to search'}
                      </Text>
                    )}
                  </View>
                )}

                <View
                  style={[
                    styles.voiceStatusCard,
                    speechPhase !== 'idle' && styles.voiceStatusCardActive,
                  ]}
                >
                  <View style={styles.voiceStatusHeader}>
                    <View
                      style={[
                        styles.voiceStatusIconWrap,
                        speechPhase !== 'idle' && styles.voiceStatusIconWrapActive,
                        voiceControlsUnavailable && styles.voiceStatusIconWrapDisabled,
                      ]}
                    >
                      <HugeiconsIcon
                        icon={Mic01Icon}
                        size={18}
                        color={voiceControlsUnavailable ? 'rgba(255,255,255,0.78)' : COLORS.white}
                      />
                    </View>
                    <Text style={styles.voiceStatusTitle}>{voiceStatusTitle}</Text>
                    <View style={styles.voiceStatusBadge}>
                      <Text style={styles.voiceStatusBadgeText}>{voiceStatusBadge}</Text>
                    </View>
                  </View>
                  <Text style={styles.voiceStatusBody}>{voiceStatusBody}</Text>
                  {voicePreviewText.length > 0 ? (
                    <Text style={styles.voiceStatusPreview}>{voicePreviewText}</Text>
                  ) : null}
                  <Text style={styles.voiceMetaText}>
                    Voice language: {getVoiceLanguageLabel(savedPreferences.voiceLanguage)}
                  </Text>
                  {voiceError !== null && speechPhase === 'idle' ? (
                    <Text style={styles.voiceErrorText}>{voiceError}</Text>
                  ) : null}
                  {voiceTranscriptNotice !== null ? (
                    <Text style={styles.voiceInfoText}>{voiceTranscriptNotice}</Text>
                  ) : null}
                </View>
              </>
            </View>

            <View style={styles.quickFiltersCard}>
              <View style={styles.quickFiltersHeader}>
                <Text style={styles.quickFiltersTitle}>Commute modes</Text>
                <Text style={styles.quickFiltersHint}>Saved for future searches</Text>
              </View>
              <View style={styles.quickFiltersRow}>
                {COMMUTE_MODE_OPTIONS.map((option) => {
                  const selected = commuteModes.includes(option.value);

                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.quickFilterChip, selected && styles.quickFilterChipSelected]}
                      onPress={() => handleCommuteModeChipPress(option.value)}
                    >
                      <Text
                        style={[
                          styles.quickFilterChipText,
                          selected && styles.quickFilterChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[
                    styles.quickFilterChip,
                    allowCarAccess && styles.quickFilterChipSelected,
                  ]}
                  onPress={handleCarAccessChipPress}
                >
                  <Text
                    style={[
                      styles.quickFilterChipText,
                      allowCarAccess && styles.quickFilterChipTextSelected,
                    ]}
                  >
                    {allowCarAccess ? 'Car access on' : 'Car access off'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            {/* Search button */}
            <TouchableOpacity
              style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
              onPress={handleSearch}
              disabled={!canSearch || queryLoading}
              activeOpacity={0.85}
            >
              {queryLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.searchBtnText}>Find Routes</Text>
              )}
            </TouchableOpacity>

            {/* Error */}
            {queryError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{queryError}</Text>
              </View>
            )}

            {locationNotice && (
              <View style={styles.messageCard}>
                <Text style={styles.fallbackNoteText}>{locationNotice}</Text>
              </View>
            )}

            {googleServiceNotice && (
              <View style={styles.messageCard}>
                <Text style={styles.fallbackNoteText}>{googleServiceNotice}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl + 24,
  },

  // Hero
  heroCard: {
    backgroundColor: '#102033',
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    marginBottom: SPACING.md,
  },
  heroRule: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.68)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroMicButton: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  heroMicButtonActive: {
    backgroundColor: 'rgba(0,122,255,0.28)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroMicButtonDisabled: {
    opacity: 0.65,
  },
  heroMicButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.fontSizes.hero,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    lineHeight: 38,
    marginBottom: SPACING.md,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  heroMetaBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroMetaText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },

  // Search card inside hero
  searchCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  quickFiltersCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: SPACING.sm,
  },
  quickFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  quickFiltersTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  quickFiltersHint: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.62)',
  },
  quickFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  quickFilterChip: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  quickFilterChipSelected: {
    backgroundColor: 'rgba(0,122,255,0.24)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  quickFilterChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.8)',
  },
  quickFilterChipTextSelected: {
    color: COLORS.white,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  searchFieldActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  searchInputRow: {
    minHeight: 54,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fieldHeaderActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginLeft: 'auto',
  },
  inlineActionButton: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inlineActionText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
  searchFieldLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.55)',
    width: 42,
  },
  searchFieldHint: {
    marginLeft: 'auto',
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.62)',
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: COLORS.white,
    padding: 0,
    minHeight: 24,
  },
  destinationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  clearBtn: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: FONTS.medium,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginHorizontal: SPACING.md,
  },

  // Suggestions
  inlineSuggestionsCard: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  suggestionPanel: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  suggestionsCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2EAF0',
    overflow: 'hidden',
  },
  suggestionsSpinner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  suggestionsSpinnerText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
  },
  noResults: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    padding: SPACING.md,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIconSakai: {
    backgroundColor: '#102033',
  },
  suggestionIconGoogle: {
    backgroundColor: '#4285F4',
  },
  suggestionIconText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionLabel: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: '#102033',
  },
  suggestionSecondary: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    marginTop: 1,
  },
  dismissBtn: {
    padding: SPACING.sm + 2,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  dismissText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },

  // Body
  body: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#5D7286',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 20,
  },

  // Search button
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  searchBtnDisabled: {
    backgroundColor: '#B0C4D4',
  },
  searchBtnText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },

  // Error
  errorBanner: {
    backgroundColor: '#FFF0F0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFCCC7',
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.danger,
    lineHeight: 20,
  },

  // Map
  mapContainer: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2EAF0',
    height: 220,
  },
  map: {
    flex: 1,
  },

  // Message
  messageCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2EAF0',
  },
  messageText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 22,
  },
  fallbackNoteText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#415466',
    lineHeight: 20,
    marginTop: SPACING.sm,
  },

  // Route card
  routeCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2EAF0',
    gap: SPACING.md,
  },
  routeCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  routeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  routeEyebrow: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  fareBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: '#EEF5FF',
  },
  fareBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  routeSummary: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 18,
  },
  routeProviderLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  routeProviderNote: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#F7FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E8EFF4',
  },
  statBlock: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E4ECF2',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#6B7D8E',
    marginBottom: 2,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  highlightChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#C8DFF5',
  },
  highlightText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#2D6A9F',
  },
  communityRouteCard: {
    borderRadius: RADIUS.md,
    backgroundColor: '#F4F9FD',
    borderWidth: 1,
    borderColor: '#D7E7F4',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  communityRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  communityRouteEyebrow: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  communityRouteStatus: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
    textTransform: 'capitalize',
  },
  communityRouteText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#213547',
    lineHeight: 18,
  },
  communityRouteMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
  toggleBtn: {
    alignSelf: 'flex-start',
  },
  toggleBtnText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },

  // Leg breakdown
  legList: {
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingTop: SPACING.sm,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  legBadge: {
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xs,
    minWidth: 42,
    alignItems: 'center',
  },
  legBadgeRide: {
    backgroundColor: '#E8F0FE',
  },
  legBadgeWalk: {
    backgroundColor: '#E8F5E9',
  },
  legBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  legInfo: {
    flex: 1,
    gap: 2,
  },
  legName: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  legMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
  },
  legFare: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    marginTop: 2,
  },
  fareNote: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#8A9EAD',
    lineHeight: 16,
    marginTop: SPACING.xs,
  },

  // Voice input
  voiceHoldButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  voiceHoldButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  voiceHoldButtonBusy: {
    backgroundColor: 'rgba(69,123,157,0.72)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  voiceHoldButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  voiceStatusCard: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: SPACING.xs,
  },
  voiceStatusCardActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  voiceStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  voiceStatusIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  voiceStatusIconWrapActive: {
    backgroundColor: 'rgba(0,122,255,0.26)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  voiceStatusIconWrapDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  voiceStatusTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  voiceStatusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  voiceStatusBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.88)',
  },
  voiceStatusBody: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 19,
  },
  voiceStatusPreview: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: COLORS.white,
    lineHeight: 22,
  },
  voiceMetaText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.72)',
  },
  voiceErrorText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.danger,
  },
  voiceInfoText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.72)',
  },
  resultsScreen: {
    flex: 1,
    backgroundColor: '#E8F0F7',
  },
  topOverlayRow: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 10,
  },
  floatingEditButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#DCE6F0',
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
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  loadingSheetText: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
    textAlign: 'center',
  },
  loadingSheetSubtext: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#6A7D90',
    textAlign: 'center',
    lineHeight: 20,
  },
  sheetContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  tripSummaryCard: {
    backgroundColor: '#102033',
    borderRadius: 16,
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  tripSummaryEyebrow: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tripSummaryTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  tripSummaryBody: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: 'rgba(239,246,252,0.82)',
    lineHeight: 20,
  },
  sheetSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  sheetSectionMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#7890A5',
  },
  routeCardGroup: {
    gap: SPACING.sm,
  },
  primaryActionButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
  },
  primaryActionButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
});
