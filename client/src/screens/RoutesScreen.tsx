import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Mic01Icon } from '@hugeicons/core-free-icons';
import { useIsFocused } from '@react-navigation/native';
import { ApiError } from '../api/base';
import { useAuth } from '../auth/AuthContext';
import MapSetupNotice from '../components/MapSetupNotice';
import RelevantIncidentsSection from '../components/RelevantIncidentsSection';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import SafeScreen from '../components/SafeScreen';
import { hasGoogleMapsApiKey, hasGooglePlacesApiKey } from '../config/env';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import {
  createGooglePlacesSessionToken,
  getPlaceSuggestionKey,
  resolvePlaceSuggestion,
  searchMergedPlaceSuggestions,
} from '../places/search';
import { getGoogleDirectionsPath, reverseGeocodeCurrentLocation } from '../places/api';
import { usePreferences } from '../preferences/PreferencesContext';
import { queryRoutes, queryRoutesByText } from '../routes/api';
import {
  buildCoordinateFallbackNote,
  buildRouteMarkers,
  buildRouteSegments,
  formatDuration,
  formatFare,
} from '../routes/view-models';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { transcribeSpeechRecording } from '../speech/api';
import { useVoiceSearchTrigger } from '../voice/VoiceSearchContext';
import { extractVoiceDestinationHint, normalizeVoiceRouteQuery } from '../voice/route-query';
import type { PlaceSuggestion, SakaiPlaceSuggestion, SelectedPlace } from '../places/types';
import type {
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
  car: '#102033',
  walk: '#5D7286',
};

type AudioRecordingRef = {
  stopAndUnloadAsync: () => Promise<unknown>;
  getURI: () => string | null;
};

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LegRow({ leg }: { leg: RouteQueryLeg }) {
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
          <Text style={styles.legFare}>{formatFare(leg.fare.amount)}</Text>
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
        <Text style={styles.legFare}>{formatFare(leg.fare.amount)}</Text>
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

      {option.relevantIncidents.length > 0 && (
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
          {option.relevantIncidents.length > 0 && (
            <RelevantIncidentsSection
              incidents={option.relevantIncidents}
              title="Route impact"
              metaNotice="These MMDA updates match this routeâ€™s corridor or endpoints."
            />
          )}
          {option.legs.map((leg) => (
            <LegRow key={leg.id} leg={leg} />
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
  const { preferences: savedPreferences } = usePreferences();
  const { setNavigationCandidate, startNavigation } = useNavigationAlarm();
  const isFocused = useIsFocused();
  const { triggerToken, setIsListening: setVoiceTriggerListening } = useVoiceSearchTrigger();
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [activeField, setActiveField] = useState<'origin' | 'destination' | null>(null);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectingPlace, setSelectingPlace] = useState(false);

  const [origin, setOrigin] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);

  const [preference, setPreference] = useState<RoutePreference>('balanced');
  const [passengerType, setPassengerType] = useState<PassengerType>('regular');
  const [modifiers, setModifiers] = useState<RouteModifier[]>([]);

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [googleServiceNotice, setGoogleServiceNotice] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RouteQueryResult | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [mapRouteSegments, setMapRouteSegments] = useState<ReturnType<typeof buildRouteSegments>>([]);

  // Voice input
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [speechPhase, setSpeechPhase] = useState<'idle' | 'listening' | 'transcribing' | 'searching'>('idle');
  const [recordingAvailable, setRecordingAvailable] = useState<boolean | null>(null);
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

  const mapRef = useRef<MapView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const recordingRef = useRef<AudioRecordingRef | null>(null);
  const finalizingRecordingRef = useRef(false);
  const lastVoiceTriggerRef = useRef(0);
  const directionsCacheRef = useRef<Map<string, Array<{ latitude: number; longitude: number }>>>(new Map());
  const googleSessionTokensRef = useRef<Record<'origin' | 'destination', string>>({
    origin: createGooglePlacesSessionToken(),
    destination: createGooglePlacesSessionToken(),
  });
  const hasResolvedInitialOriginRef = useRef(false);

  const activeText = activeField === 'origin' ? originText : destText;
  const accessToken = session?.accessToken;
  const isGoogleMapsConfigured = hasGoogleMapsApiKey();
  const canUseGooglePlaces = hasGooglePlacesApiKey();
  const selectedOption = routeResult?.options.find((o) => o.id === selectedOptionId) ?? null;
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

  useEffect(() => {
    setRecordingAvailable(Boolean(NativeModules.ExponentAV));
  }, []);

  const resetGoogleSessionToken = useCallback((field: 'origin' | 'destination') => {
    googleSessionTokensRef.current[field] = createGooglePlacesSessionToken();
  }, []);

  // â”€â”€ Debounced suggestion fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    setPreference(savedPreferences.defaultPreference);
    setPassengerType(savedPreferences.passengerType);
    setModifiers(savedPreferences.routeModifiers);
  }, [
    savedPreferences.defaultPreference,
    savedPreferences.passengerType,
    savedPreferences.routeModifiers,
  ]);

  useEffect(() => {
    if (!activeField) {
      setSuggestions([]);
      return;
    }

    const query = activeText.trim();

    if (query.length < 2) {
      setSuggestions([]);
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
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeField, activeText, canUseGooglePlaces]);

  // â”€â”€ Sync transcript â†’ voiceQuery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (transcript) setVoiceQuery(transcript);
  }, [transcript]);

  useEffect(() => {
    setVoiceTriggerListening(speechPhase === 'listening');

    return () => {
      setVoiceTriggerListening(false);
    };
  }, [setVoiceTriggerListening, speechPhase]);

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

  const resolveCurrentOrigin = useCallback(async () => {
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

      setOrigin(place);
      setOriginText(place.label);
      setLocationNotice(null);
      return place;
    } catch (error) {
      setLocationNotice(
        error instanceof Error
          ? error.message
          : 'Current location could not be loaded. Choose your origin manually.'
      );
      return null;
    }
  }, []);

  const runVoiceSearch = useCallback(
    async (spokenQuery: string, originFallback?: SelectedPlace | null) => {
      const normalizedQuery = normalizeVoiceRouteQuery(spokenQuery);

      if (normalizedQuery.length === 0) {
        throw new Error('No route request was detected. Try saying your destination again.');
      }

      setVoiceMode(false);
      setVoiceQuery(normalizedQuery);
      const destinationHint = extractVoiceDestinationHint(normalizedQuery);
      if (destinationHint.length > 0) {
        setDestText(destinationHint);
        setDestination(null);
      }

      setQueryLoading(true);
      setQueryError(null);
      setRouteResult(null);
      setSelectedOptionId(null);
      setExpandedOptions(new Set());
      setSpeechPhase('searching');

      try {
        const result = await queryRoutesByText({
          queryText: normalizedQuery,
          originFallback: originFallback ?? undefined,
          preference,
          passengerType,
          modifiers,
          accessToken,
        });

        setRouteResult(result);
        setSelectedOptionId(result.options[0]?.id ?? null);
        setExpandedOptions(result.options[0] ? new Set([result.options[0].id]) : new Set());
        setOriginText(result.normalizedQuery.origin.label);
        setDestText(result.normalizedQuery.destination.label);
      } finally {
        setQueryLoading(false);
        setSpeechPhase('idle');
      }
    },
    [accessToken, modifiers, passengerType, preference]
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
        const fallbackOrigin = origin ?? (await resolveCurrentOrigin());
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
      });
      const fallbackOrigin = origin ?? (await resolveCurrentOrigin());
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
      setVoiceTriggerListening(false);
    }
  }, [accessToken, origin, resolveCurrentOrigin, runVoiceSearch, setVoiceTriggerListening, transcript]);

  const startSpeechCapture = useCallback(async () => {
    if (speechPhase !== 'idle') {
      return;
    }

    if (!voiceAvailable) {
      setQueryError('Voice input is unavailable in this build.');
      return;
    }

    try {
      setActiveField(null);
      setSuggestions([]);
      setVoiceMode(true);
      setQueryError(null);
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
  }, [recordingAvailable, resetTranscript, speechPhase, startListening, voiceAvailable]);

  const stopSpeechCapture = useCallback(async () => {
    if (speechPhase !== 'listening') {
      return;
    }

    await stopListening();
    await finalizeRecordingAndSearch();
  }, [finalizeRecordingAndSearch, speechPhase, stopListening]);

  const cancelSpeechCapture = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    setSpeechPhase('idle');

    if (isListening) {
      await stopListening();
    }

    if (recording) {
      await recording.stopAndUnloadAsync().catch(() => undefined);
    }
    setVoiceTriggerListening(false);
  }, [isListening, setVoiceTriggerListening, stopListening]);

  useEffect(() => {
    if (voiceMode || origin !== null || hasResolvedInitialOriginRef.current) {
      return;
    }

    hasResolvedInitialOriginRef.current = true;
    void resolveCurrentOrigin();
  }, [origin, resolveCurrentOrigin, voiceMode]);

  useEffect(() => {
    if (!isFocused || triggerToken === 0 || triggerToken === lastVoiceTriggerRef.current) {
      return;
    }

    lastVoiceTriggerRef.current = triggerToken;

    if (speechPhase === 'listening') {
      void stopSpeechCapture();
      return;
    }

    void startSpeechCapture();
  }, [isFocused, speechPhase, startSpeechCapture, stopSpeechCapture, triggerToken]);

  useEffect(() => {
    if (speechPhase !== 'listening' || isListening || !recordingRef.current) {
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

        if (field === 'origin') {
          setOrigin(resolved);
          setOriginText(resolved.label);
          setLocationNotice(null);
        } else {
          setDestination(resolved);
          setDestText(resolved.label);
        }
        setRouteResult(null);
        setSelectedOptionId(null);
        setExpandedOptions(new Set());
        resetGoogleSessionToken(field);
        setActiveField(null);
        setSuggestions([]);
      } catch (error) {
        setQueryError(
          error instanceof Error
            ? error.message
            : 'Unable to load that place right now. Try another result.'
        );
      } finally {
        setSelectingPlace(false);
      }
    },
    [activeField, resetGoogleSessionToken]
  );

  const enterVoiceMode = useCallback(() => {
    setActiveField(null);
    setSuggestions([]);
    void startSpeechCapture();
  }, [startSpeechCapture]);

  const exitVoiceMode = useCallback(async () => {
    try {
      if (speechPhase === 'listening') {
        await cancelSpeechCapture();
      } else if (isListening) {
        await stopListening();
      }
    } finally {
      recordingRef.current = null;
      setSpeechPhase('idle');
      resetTranscript();
      setVoiceQuery('');
      setVoiceMode(false);
    }
  }, [cancelSpeechCapture, isListening, resetTranscript, speechPhase, stopListening]);

  const handleSearch = useCallback(async () => {
    if (queryLoading) return;

    const trimmedVoiceQuery = voiceQuery.trim();
    const selectedOrigin = origin;
    const selectedDestination = destination;

    if (voiceMode) {
      if (trimmedVoiceQuery.length === 0) return;
    } else if (!selectedOrigin || !selectedDestination) {
      return;
    }

    setQueryLoading(true);
    setQueryError(null);
    setRouteResult(null);
    setSelectedOptionId(null);
    setExpandedOptions(new Set());
    try {
      let result: RouteQueryResult;
      if (voiceMode) {
        const fallbackOrigin = selectedOrigin ?? (await resolveCurrentOrigin());
        result = await queryRoutesByText({
          queryText: trimmedVoiceQuery,
          originFallback: fallbackOrigin ?? undefined,
          preference,
          passengerType,
          modifiers,
          accessToken,
        });
      } else {
        if (selectedOrigin === null || selectedDestination === null) {
          return;
        }

        result = await queryRoutes({
          origin: selectedOrigin,
          destination: selectedDestination,
          preference,
          passengerType,
          modifiers,
          accessToken,
        });
      }
      setRouteResult(result);
      if (result.options[0]) setSelectedOptionId(result.options[0].id);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 400) {
        const details = err.details;

        if (
          details !== null &&
          typeof details === 'object' &&
          'reasonCode' in details &&
          details.reasonCode === 'clarification_required'
        ) {
          const detailRecord = details as Record<string, unknown>;
          const field = detailRecord.field === 'origin' ? 'origin' : 'destination';
          const rawMatches = Array.isArray(detailRecord.matches)
            ? detailRecord.matches
            : Array.isArray(detailRecord.destinationMatches)
              ? detailRecord.destinationMatches
              : Array.isArray(detailRecord.originMatches)
                ? detailRecord.originMatches
                : [];
          const clarificationSuggestions: PlaceSuggestion[] = rawMatches.flatMap((match) => {
            if (typeof match !== 'object' || match === null) {
              return [];
            }

            const candidate = match as Record<string, unknown>;

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

            const suggestion: SakaiPlaceSuggestion = {
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
            };

            return [suggestion];
          });

          if (clarificationSuggestions.length > 0) {
            setSuggestions(clarificationSuggestions);
            setActiveField(field);
            setQueryError('Choose the stop cluster you meant.');
            return;
          }
        }
      }

      setQueryError(err instanceof Error ? err.message : 'Route search failed. Try again.');
    } finally {
      setQueryLoading(false);
    }
  }, [accessToken, destination, modifiers, origin, passengerType, preference, queryLoading, resolveCurrentOrigin, voiceMode, voiceQuery]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearField = useCallback((field: 'origin' | 'destination') => {
    if (field === 'origin') {
      setOrigin(null);
      setOriginText('');
      setLocationNotice(null);
    } else {
      setDestination(null);
      setDestText('');
    }
    setRouteResult(null);
    setSelectedOptionId(null);
    setQueryError(null);
    setActiveField(field);
  }, []);

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const canSearch = voiceMode
    ? voiceQuery.trim().length > 0
    : origin !== null && destination !== null;

  useEffect(() => {
    if (!selectedOption) {
      setNavigationCandidate(null);
      return;
    }

    setNavigationCandidate({
      routeId: selectedOption.id,
      routeLabel: selectedOption.recommendationLabel,
      summary: selectedOption.summary,
      durationLabel: formatDuration(selectedOption.totalDurationMinutes),
      fareLabel: formatFare(selectedOption.totalFare),
      originLabel: routeResult?.normalizedQuery.origin.label ?? origin?.label ?? 'Origin',
      destinationLabel:
        routeResult?.normalizedQuery.destination.label ?? destination?.label ?? 'Destination',
      corridorTags: selectedOption.corridorTags,
      relevantIncidents: selectedOption.relevantIncidents,
      destination: selectedOption.navigationTarget,
    });
  }, [destination?.label, origin?.label, routeResult?.normalizedQuery.destination.label, routeResult?.normalizedQuery.origin.label, selectedOption, setNavigationCandidate]);

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          scrollEnabled={!isMapInteracting}
        >
          {/* â”€â”€ Hero card â”€â”€ */}
          <View style={styles.heroCard}>
            <View style={styles.heroRule} />
            <View style={styles.heroTopRow}>
              <Text style={styles.heroLabel}>Routes</Text>
            </View>
            <Text style={styles.heroTitle}>Where to Sakai today?</Text>

            <View style={styles.searchCard}>
              {voiceMode ? (
                /* â”€â”€ Voice mode â”€â”€ */
                <View style={styles.voiceCard}>
                  <TextInput
                    style={styles.voiceInput}
                    value={isListening ? partialTranscript : voiceQuery}
                    onChangeText={setVoiceQuery}
                    placeholder={isListening ? 'Listening...' : 'Say your destination...'}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    editable={!isListening}
                    multiline
                  />

                  <View style={styles.voiceActions}>
                    <TouchableOpacity
                      style={[styles.micBtn, isListening && styles.micBtnActive]}
                      onPress={speechPhase === 'listening' ? stopSpeechCapture : startSpeechCapture}
                    >
                      <HugeiconsIcon
                        icon={isListening ? Cancel01Icon : Mic01Icon}
                        size={22}
                        color={COLORS.white}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        void exitVoiceMode();
                      }}
                      style={styles.switchToTypeBtn}
                    >
                      <Text style={styles.switchToTypeText}>Type instead</Text>
                    </TouchableOpacity>
                  </View>

                  {voiceError !== null && (
                    <Text style={styles.voiceErrorText}>{voiceError}</Text>
                  )}
                </View>
              ) : (
                /* â”€â”€ Structured From/To mode â”€â”€ */
                <>
                  {/* From */}
                  <View style={[styles.searchField, activeField === 'origin' && styles.searchFieldActive]}>
                    <Text style={styles.searchFieldLabel}>From</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={originText}
                      onChangeText={(text) => {
                        setOriginText(text);
                        if (origin) setOrigin(null);
                        setRouteResult(null);
                        setSelectedOptionId(null);
                        setQueryError(null);
                        setActiveField('origin');
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
                    <TextInput
                      style={styles.searchInput}
                      value={destText}
                      onChangeText={(text) => {
                        setDestText(text);
                        if (destination) setDestination(null);
                        setRouteResult(null);
                        setSelectedOptionId(null);
                        setQueryError(null);
                        setActiveField('destination');
                      }}
                      onFocus={() => setActiveField('destination')}
                      placeholder="Destination"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      returnKeyType="search"
                      onSubmitEditing={canSearch ? handleSearch : undefined}
                    />
                    {destText.length > 0 && (
                      <TouchableOpacity
                        onPress={() => clearField('destination')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.clearBtn}>x</Text>
                      </TouchableOpacity>
                    )}
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

                  {/* Speak instead toggle */}
                  {voiceAvailable && (
                    <TouchableOpacity
                      style={styles.voiceToggle}
                      onPress={enterVoiceMode}
                    >
                      <HugeiconsIcon icon={Mic01Icon} size={16} color={COLORS.primary} />
                      <Text style={styles.voiceToggleText}>Speak instead</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

          {/* â”€â”€ Body â”€â”€ */}
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

            {speechPhase !== 'idle' && (
              <View style={styles.messageCard}>
                <Text style={styles.fallbackNoteText}>
                  {speechPhase === 'listening'
                    ? 'Listening... say where you want to go.'
                    : speechPhase === 'transcribing'
                      ? 'Transcribing your route request...'
                      : 'Searching routes from your current location...'}
                </Text>
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

            {/* Map */}
            {routeResult && (
              <View style={styles.mapContainer}>
                {isGoogleMapsConfigured ? (
                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    onTouchStart={() => setIsMapInteracting(true)}
                    onTouchEnd={() => setIsMapInteracting(false)}
                    onTouchCancel={() => setIsMapInteracting(false)}
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
              </View>
            )}

            {/* No-options message */}
            {routeResult && routeResult.options.length === 0 && routeResult.message && (
              <View style={styles.messageCard}>
                <Text style={styles.messageText}>{routeResult.message}</Text>
                {coordinateFallbackNote && (
                  <Text style={styles.fallbackNoteText}>{coordinateFallbackNote}</Text>
                )}
                {driveContextNote && <Text style={styles.fallbackNoteText}>{driveContextNote}</Text>}
              </View>
            )}

            {routeResult && routeResult.options.length > 0 && (coordinateFallbackNote || driveContextNote) && (
              <View style={styles.messageCard}>
                {coordinateFallbackNote && <Text style={styles.fallbackNoteText}>{coordinateFallbackNote}</Text>}
                {driveContextNote && <Text style={styles.fallbackNoteText}>{driveContextNote}</Text>}
              </View>
            )}

            {/* Route cards */}
            {routeResult?.options.map((option) => (
              <View key={option.id}>
                <RouteCard
                  option={option}
                  compactIncidentMeta="Shown because this route may be affected."
                  selected={option.id === selectedOptionId}
                  onSelect={() => setSelectedOptionId(option.id)}
                  expanded={expandedOptions.has(option.id)}
                  onToggleLegs={() => toggleExpanded(option.id)}
                />
                {option.id === selectedOptionId && (
                  <TouchableOpacity
                    style={styles.searchBtn}
                    onPress={() => {
                      void startNavigation();
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.searchBtnText}>Start route</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
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
  heroBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
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
  searchFieldLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.55)',
    width: 30,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: COLORS.white,
    padding: 0,
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
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  voiceToggleText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  voiceCard: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  voiceInput: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: COLORS.white,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  voiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: COLORS.danger,
  },
  switchToTypeBtn: {
    paddingVertical: SPACING.sm,
  },
  switchToTypeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.55)',
  },
  voiceErrorText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.danger,
  },
});


