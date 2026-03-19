import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Mic01Icon } from '@hugeicons/core-free-icons';
import { useAuth } from '../auth/AuthContext';
import MapSetupNotice from '../components/MapSetupNotice';
import SafeScreen from '../components/SafeScreen';
import { hasGoogleMapsApiKey, hasGooglePlacesApiKey } from '../config/env';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import {
  createGooglePlacesSessionToken,
  getPlaceSuggestionKey,
  resolvePlaceSuggestion,
  searchMergedPlaceSuggestions,
} from '../places/search';
import { usePreferences } from '../preferences/PreferencesContext';
import { queryRoutes, queryRoutesByText } from '../routes/api';
import {
  buildCoordinateFallbackNote,
  buildRouteMarkers,
  formatDuration,
  formatFare,
} from '../routes/view-models';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { PlaceSuggestion, SelectedPlace } from '../places/types';
import type {
  PassengerType,
  RoutePreference,
  RouteQueryLeg,
  RouteQueryOption,
  RouteQueryResult,
} from '../routes/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const PREFERENCES: { key: RoutePreference; label: string }[] = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'fastest', label: 'Fastest' },
  { key: 'cheapest', label: 'Cheapest' },
];

const PASSENGER_TYPES: { key: PassengerType; label: string }[] = [
  { key: 'regular', label: 'Regular' },
  { key: 'student', label: 'Student' },
  { key: 'senior', label: 'Senior' },
  { key: 'pwd', label: 'PWD' },
];

const MODE_LABELS: Record<string, string> = {
  jeepney: 'Jeep',
  uv: 'UV',
  mrt3: 'MRT3',
  lrt1: 'LRT1',
  lrt2: 'LRT2',
  bus: 'Bus',
};

const MARKER_COLORS: Record<string, string> = {
  origin: COLORS.success,
  destination: COLORS.danger,
  stop: COLORS.primary,
  transfer: COLORS.warning,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
            {leg.distanceMeters}m · {formatDuration(leg.durationMinutes)}
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
          {leg.fromStop.stopName} → {leg.toStop.stopName}
        </Text>
        <Text style={styles.legFare}>{formatFare(leg.fare.amount)}</Text>
      </View>
    </View>
  );
}

function RouteCard({
  option,
  selected,
  onSelect,
  expanded,
  onToggleLegs,
}: {
  option: RouteQueryOption;
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

      <TouchableOpacity onPress={onToggleLegs} style={styles.toggleBtn} activeOpacity={0.7}>
        <Text style={styles.toggleBtnText}>{expanded ? 'Hide breakdown' : 'Show breakdown'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.legList}>
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

function SuggestionRow({
  suggestion,
  onSelect,
}: {
  suggestion: PlaceSuggestion;
  onSelect: (s: PlaceSuggestion) => void;
}) {
  const isSakai = suggestion.source === 'sakai';
  const secondary = isSakai ? `${suggestion.city} · ${suggestion.kind}` : suggestion.secondaryText;

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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RoutesScreen() {
  const { session } = useAuth();
  const { preferences: savedPreferences } = usePreferences();
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

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RouteQueryResult | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

  // Voice input
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
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
  const googleSessionTokensRef = useRef<Record<'origin' | 'destination', string>>({
    origin: createGooglePlacesSessionToken(),
    destination: createGooglePlacesSessionToken(),
  });

  const activeText = activeField === 'origin' ? originText : destText;
  const accessToken = session?.accessToken;
  const isGoogleMapsConfigured = hasGoogleMapsApiKey();
  const canUseGooglePlaces = hasGooglePlacesApiKey();

  const resetGoogleSessionToken = useCallback((field: 'origin' | 'destination') => {
    googleSessionTokensRef.current[field] = createGooglePlacesSessionToken();
  }, []);

  // ── Debounced suggestion fetch ──────────────────────────────────────────────

  useEffect(() => {
    setPreference(savedPreferences.defaultPreference);
    setPassengerType(savedPreferences.passengerType);
  }, [savedPreferences.defaultPreference, savedPreferences.passengerType]);

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

  // ── Sync transcript → voiceQuery ───────────────────────────────────────────

  useEffect(() => {
    if (transcript) setVoiceQuery(transcript);
  }, [transcript]);

  // ── Map fit after result ────────────────────────────────────────────────────

  useEffect(() => {
    if (!routeResult || !selectedOptionId) return;
    const option = routeResult.options.find((o) => o.id === selectedOptionId);
    if (!option) return;

    const markers = buildRouteMarkers({ origin, destination, option });
    if (markers.length < 2) return;

    const coords = markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude }));
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }, 300);
  }, [routeResult, selectedOptionId, origin, destination]);

  // ── Handlers ────────────────────────────────────────────────────────────────

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
    setVoiceMode(true);
  }, []);

  const exitVoiceMode = useCallback(async () => {
    try {
      if (isListening) {
        await stopListening();
      }
    } finally {
      resetTranscript();
      setVoiceQuery('');
      setVoiceMode(false);
    }
  }, [isListening, resetTranscript, stopListening]);

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
        result = await queryRoutesByText({
          queryText: trimmedVoiceQuery,
          preference,
          passengerType,
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
          accessToken,
        });
      }
      setRouteResult(result);
      if (result.options[0]) setSelectedOptionId(result.options[0].id);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : 'Route search failed. Try again.');
    } finally {
      setQueryLoading(false);
    }
  }, [accessToken, destination, origin, passengerType, preference, queryLoading, voiceMode, voiceQuery]);

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
    } else {
      setDestination(null);
      setDestText('');
    }
    setRouteResult(null);
    setSelectedOptionId(null);
    setQueryError(null);
    setActiveField(field);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedOption = routeResult?.options.find((o) => o.id === selectedOptionId) ?? null;
  const mapMarkers = buildRouteMarkers({ origin, destination, option: selectedOption });
  const coordinateFallbackNote = buildCoordinateFallbackNote({
    routeResult,
    origin,
    destination,
  });
  const canSearch = voiceMode
    ? voiceQuery.trim().length > 0
    : origin !== null && destination !== null;
  const activePreferenceLabel = PREFERENCES.find((p) => p.key === preference)?.label ?? 'Balanced';
  const activePassengerLabel =
    PASSENGER_TYPES.find((p) => p.key === passengerType)?.label ?? 'Regular';

  // ── Render ───────────────────────────────────────────────────────────────────

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
          {/* ── Hero card ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroRule} />
            <View style={styles.heroTopRow}>
              <Text style={styles.heroLabel}>Routes</Text>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{activePreferenceLabel}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Where to Sakai today?</Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaBadge}>
                <Text style={styles.heroMetaText}>Fare profile: {activePassengerLabel}</Text>
              </View>
            </View>

            <View style={styles.searchCard}>
              {voiceMode ? (
                /* ── Voice mode ── */
                <View style={styles.voiceCard}>
                  <TextInput
                    style={styles.voiceInput}
                    value={isListening ? partialTranscript : voiceQuery}
                    onChangeText={setVoiceQuery}
                    placeholder={isListening ? 'Listening…' : 'Say your destination…'}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    editable={!isListening}
                    multiline
                  />

                  <View style={styles.voiceActions}>
                    <TouchableOpacity
                      style={[styles.micBtn, isListening && styles.micBtnActive]}
                      onPress={isListening ? stopListening : startListening}
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
                /* ── Structured From/To mode ── */
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
                      placeholder="Origin"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      returnKeyType="next"
                    />
                    {originText.length > 0 && (
                      <TouchableOpacity
                        onPress={() => clearField('origin')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.clearBtn}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

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
                        <Text style={styles.clearBtn}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

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

          {/* ── Suggestion list ── */}
          {activeField !== null && (
            <View style={styles.suggestionsCard}>
              {suggestionsLoading || selectingPlace ? (
                <View style={styles.suggestionsSpinner}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.suggestionsSpinnerText}>
                    {selectingPlace ? 'Getting location…' : 'Searching…'}
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
              <TouchableOpacity
                onPress={() => {
                  setActiveField(null);
                  setSuggestions([]);
                }}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Body ── */}
          <View style={styles.body}>
            {/* Preference chips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preference</Text>
              <View style={styles.chipRow}>
                {PREFERENCES.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.chip, preference === p.key && styles.chipActive]}
                    onPress={() => setPreference(p.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, preference === p.key && styles.chipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Passenger type chips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Passenger</Text>
              <View style={styles.chipRow}>
                {PASSENGER_TYPES.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.chip, passengerType === p.key && styles.chipActive]}
                    onPress={() => setPassengerType(p.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, passengerType === p.key && styles.chipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionHint}>
                Saved default: {PASSENGER_TYPES.find((p) => p.key === savedPreferences.passengerType)?.label ?? 'Regular'}
              </Text>
            </View>

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

            {/* Map */}
            {routeResult && (
              <View style={styles.mapContainer}>
                {isGoogleMapsConfigured ? (
                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{
                      latitude: 14.5995,
                      longitude: 120.9842,
                      latitudeDelta: 0.2,
                      longitudeDelta: 0.2,
                    }}
                  >
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
              </View>
            )}

            {routeResult && routeResult.options.length > 0 && coordinateFallbackNote && (
              <View style={styles.messageCard}>
                <Text style={styles.fallbackNoteText}>{coordinateFallbackNote}</Text>
              </View>
            )}

            {/* Route cards */}
            {routeResult?.options.map((option) => (
              <RouteCard
                key={option.id}
                option={option}
                selected={option.id === selectedOptionId}
                onSelect={() => setSelectedOptionId(option.id)}
                expanded={expandedOptions.has(option.id)}
                onToggleLegs={() => toggleExpanded(option.id)}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: '#DCE7EF',
  },
  chipActive: {
    backgroundColor: '#102033',
    borderColor: '#102033',
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#415466',
  },
  chipTextActive: {
    color: COLORS.white,
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
