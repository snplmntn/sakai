import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
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
import {
  clearActiveNavigationSession,
  readActiveNavigationSession,
  writeActiveNavigationSession,
} from '../navigation-alert/storage';
import { NEAR_DESTINATION_LOCATION_TASK } from '../navigation-alert/task';
import type {
  AlarmMode,
  AlertRadiusMeters,
  NavigationTarget,
} from '../navigation-alert/types';
import {
  ALERT_RADIUS_OPTIONS,
  calculateDistanceMeters,
  formatDistanceAway,
  resolveNavigationTarget,
} from '../navigation-alert/utils';
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
import {
  getNotificationAlertPattern,
  requestArrivalNotificationPermission,
  scheduleArrivalNotification,
} from '../navigation-alert/notification-service';
import { useToast } from '../toast/ToastContext';

const DEFAULT_REGION: Region = {
  latitude: 14.517,
  longitude: 121.024,
  latitudeDelta: 0.18,
  longitudeDelta: 0.12,
};

const SEARCH_EXAMPLES = ['Pasay', 'Magallanes', 'Gate 3'];
const ALARM_MODES: Array<{ label: string; value: AlarmMode }> = [
  { label: 'Sound', value: 'sound' },
  { label: 'Vibrate', value: 'vibration' },
  { label: 'Both', value: 'both' },
];
const ALERT_VIBRATION_PATTERN = getNotificationAlertPattern();

type ActiveField = 'origin' | 'destination' | null;
type SearchMode = 'structured' | 'ai';
type LiveCoordinate = {
  latitude: number;
  longitude: number;
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

const toLiveCoordinate = (location: Location.LocationObject): LiveCoordinate => ({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
});

export default function TripMapScreen() {
  const { session } = useAuth();
  const { preferences: savedPreferences } = usePreferences();
  const { showToast } = useToast();
  const mapRef = useRef<MapView | null>(null);
  const routeSearchRequestIdRef = useRef(0);
  const foregroundLocationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const hasTriggeredArrivalAlertRef = useRef(false);
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
  const [isStartingNavigation, setIsStartingNavigation] = useState(false);
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  const [activeNavigationRouteId, setActiveNavigationRouteId] = useState<string | null>(null);
  const [nearDestinationEnabled, setNearDestinationEnabled] = useState(true);
  const [alarmMode, setAlarmMode] = useState<AlarmMode>('both');
  const [alertRadiusMeters, setAlertRadiusMeters] = useState<AlertRadiusMeters>(300);
  const [distanceToTargetMeters, setDistanceToTargetMeters] = useState<number | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LiveCoordinate | null>(null);
  const [hasTriggeredArrivalAlert, setHasTriggeredArrivalAlert] = useState(false);
  const [backgroundMonitoringActive, setBackgroundMonitoringActive] = useState(false);
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
  const selectedRoute = useMemo<RouteQueryOption | null>(
    () =>
      routeResult?.options.find((option) => option.id === selectedRouteId) ??
      routeResult?.options[0] ??
      null,
    [routeResult, selectedRouteId]
  );
  const navigationRoute = useMemo<RouteQueryOption | null>(
    () =>
      routeResult?.options.find((option) => option.id === activeNavigationRouteId) ??
      selectedRoute,
    [activeNavigationRouteId, routeResult, selectedRoute]
  );
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

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const storedSession = await readActiveNavigationSession();
      const hasBackgroundUpdates = await Location.hasStartedLocationUpdatesAsync(
        NEAR_DESTINATION_LOCATION_TASK
      );

      if (!isMounted) {
        return;
      }

      if (storedSession && hasBackgroundUpdates) {
        setIsNavigationActive(true);
        setActiveNavigationRouteId(storedSession.routeId);
        setSelectedRouteId((currentValue) => currentValue ?? storedSession.routeId);
        setNavigationTarget(storedSession.destination);
        setAlarmMode(storedSession.alarmMode);
        setAlertRadiusMeters(storedSession.alertRadiusMeters);
        setNearDestinationEnabled(storedSession.nearDestinationEnabled);
        setBackgroundMonitoringActive(true);
      } else if (storedSession) {
        await clearActiveNavigationSession();
      } else if (hasBackgroundUpdates) {
        await Location.stopLocationUpdatesAsync(NEAR_DESTINATION_LOCATION_TASK).catch((error: unknown) => {
          console.warn('Unable to stop orphaned background location updates', error);
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      foregroundLocationSubscriptionRef.current?.remove();
      foregroundLocationSubscriptionRef.current = null;
    };
  }, []);

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

  const stopBackgroundMonitoring = async (): Promise<void> => {
    try {
      const hasStartedUpdates = await Location.hasStartedLocationUpdatesAsync(
        NEAR_DESTINATION_LOCATION_TASK
      );

      if (hasStartedUpdates) {
        await Location.stopLocationUpdatesAsync(NEAR_DESTINATION_LOCATION_TASK);
      }
    } catch (error) {
      console.warn('Unable to stop background navigation monitoring', error);
    }

    setBackgroundMonitoringActive(false);
  };

  const stopNavigation = async (options?: {
    preserveTriggeredState?: boolean;
    toastMessage?: string;
  }): Promise<void> => {
    foregroundLocationSubscriptionRef.current?.remove();
    foregroundLocationSubscriptionRef.current = null;

    await stopBackgroundMonitoring();
    await clearActiveNavigationSession();

    setIsNavigationActive(false);
    setActiveNavigationRouteId(null);
    setNavigationTarget(null);
    setCurrentLocation(null);
    setDistanceToTargetMeters(null);

    if (!options?.preserveTriggeredState) {
      hasTriggeredArrivalAlertRef.current = false;
      setHasTriggeredArrivalAlert(false);
    }

    if (options?.toastMessage) {
      showToast({
        tone: 'info',
        title: 'Navigation stopped',
        message: options.toastMessage,
      });
    }
  };

  const triggerArrivalAlert = async (target: NavigationTarget): Promise<void> => {
    if (hasTriggeredArrivalAlertRef.current) {
      return;
    }

    hasTriggeredArrivalAlertRef.current = true;
    setHasTriggeredArrivalAlert(true);

    if (alarmMode !== 'sound') {
      Vibration.vibrate(ALERT_VIBRATION_PATTERN);
    }

    showToast({
      tone: 'success',
      title: 'Near your stop',
      message: `You are within ${alertRadiusMeters} meters of ${target.label}.`,
      durationMs: 5000,
    });

    const hasNotification = await scheduleArrivalNotification({
      routeId: activeNavigationRouteId,
      targetLabel: target.label,
      alertRadiusMeters,
      alarmMode,
    });

    if (!hasNotification) {
      console.info('Navigation alert delivered with vibration/toast only.');
    }

    await stopNavigation({ preserveTriggeredState: true });
  };

  const handleLiveLocationUpdate = async (
    location: LiveCoordinate,
    target: NavigationTarget,
    shouldTriggerAlert: boolean
  ): Promise<void> => {
    setCurrentLocation(location);

    const distanceMeters = calculateDistanceMeters(location, target);
    setDistanceToTargetMeters(distanceMeters);

    if (
      shouldTriggerAlert &&
      distanceMeters <= alertRadiusMeters &&
      !hasTriggeredArrivalAlertRef.current
    ) {
      await triggerArrivalAlert(target);
    }
  };

  const startNavigation = async (): Promise<void> => {
    if (!selectedRoute) {
      showToast({
        tone: 'info',
        title: 'Pick a route first',
        message: 'Select a route card before starting navigation mode.',
      });
      return;
    }

    const target = resolveNavigationTarget({
      destination: destinationSelection,
      option: selectedRoute,
    });

    if (!target) {
      showToast({
        tone: 'info',
        title: 'Destination unavailable',
        message: 'Sakai needs destination coordinates or a final stop to arm the arrival alert.',
      });
      return;
    }

    setIsStartingNavigation(true);

    try {
      const foregroundPermission = await Location.requestForegroundPermissionsAsync();

      if (foregroundPermission.status !== 'granted') {
        showToast({
          tone: 'info',
          title: 'Location required',
          message: 'Allow location access to monitor when you are near your stop.',
        });
        return;
      }

      const canNotify = await requestArrivalNotificationPermission();

      if (!canNotify) {
        showToast({
          tone: 'info',
          title: 'Notifications limited',
          message:
            'Sakai can still alert while the app is open, but notification permission is unavailable in this environment.',
        });
      }

      foregroundLocationSubscriptionRef.current?.remove();
      foregroundLocationSubscriptionRef.current = null;
      setIsNavigationActive(true);
      hasTriggeredArrivalAlertRef.current = false;
      setHasTriggeredArrivalAlert(false);
      setActiveNavigationRouteId(selectedRoute.id);
      setSelectedRouteId(selectedRoute.id);
      setNavigationTarget(target);
      setDistanceToTargetMeters(null);
      setCurrentLocation(null);

      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const initialCoordinate = toLiveCoordinate(initialLocation);
      const initialDistanceMeters = calculateDistanceMeters(initialCoordinate, target);

      setCurrentLocation(initialCoordinate);
      setDistanceToTargetMeters(initialDistanceMeters);

      if (nearDestinationEnabled && initialDistanceMeters <= alertRadiusMeters) {
        await triggerArrivalAlert(target);
        return;
      }

      foregroundLocationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 12000,
          distanceInterval: 40,
        },
        (location) => {
          void handleLiveLocationUpdate(
            toLiveCoordinate(location),
            target,
            nearDestinationEnabled
          );
        }
      );

      if (nearDestinationEnabled) {
        const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
        const backgroundGranted = backgroundPermission.status === 'granted';

        if (backgroundGranted && canNotify) {
          await writeActiveNavigationSession({
            routeId: selectedRoute.id,
            routeLabel: selectedRoute.recommendationLabel,
            destination: target,
            alertRadiusMeters,
            alarmMode,
            nearDestinationEnabled,
            startedAt: new Date().toISOString(),
          });

          await Location.startLocationUpdatesAsync(NEAR_DESTINATION_LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50,
            deferredUpdatesDistance: 50,
            deferredUpdatesInterval: 15000,
            pausesUpdatesAutomatically: false,
            foregroundService: {
              notificationTitle: 'Sakai navigation alert active',
              notificationBody: `Watching for arrival near ${target.label}.`,
            },
          });

          setBackgroundMonitoringActive(true);
        } else {
          await clearActiveNavigationSession();
          setBackgroundMonitoringActive(false);
          showToast({
            tone: 'info',
            title: 'Foreground-only monitoring',
            message:
              'Background arrival alarms need background location and notification permission.',
          });
        }
      } else {
        await clearActiveNavigationSession();
        setBackgroundMonitoringActive(false);
      }
    } catch (error) {
      await stopNavigation();
      showToast({
        tone: 'error',
        title: 'Navigation unavailable',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to start near-destination monitoring right now.',
      });
    } finally {
      setIsStartingNavigation(false);
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
          passengerType: savedPreferences.passengerType,
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
  }, [
    destinationSelection,
    originSelection,
    preference,
    savedPreferences.passengerType,
    searchMode,
    session?.accessToken,
  ]);

  useEffect(() => {
    if (isNavigationActive && routeResult === null) {
      void stopNavigation({ toastMessage: 'Your trip changed, so the active alert was cleared.' });
    }
  }, [isNavigationActive, routeResult]);

  useEffect(() => {
    if (!isNavigationActive || !activeNavigationRouteId) {
      return;
    }

    if (!routeResult?.options.some((option) => option.id === activeNavigationRouteId)) {
      void stopNavigation({ toastMessage: 'The active route is no longer available.' });
      return;
    }

    if (selectedRouteId !== activeNavigationRouteId) {
      setSelectedRouteId(activeNavigationRouteId);
    }
  }, [activeNavigationRouteId, isNavigationActive, routeResult, selectedRouteId]);

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

    if (isNavigationActive) {
      await stopNavigation({
        toastMessage: 'The active trip was cleared before starting a new search.',
      });
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

    if (isNavigationActive) {
      await stopNavigation({
        toastMessage: 'The active trip was cleared before switching search mode.',
      });
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
        if (isNavigationActive) {
          await stopNavigation({
            toastMessage: 'The active trip was cleared because the origin changed.',
          });
        }

        setOriginSelection(selected);
        setOriginQuery(selected.label);
      } else if (field === 'destination') {
        if (!originSelection) {
          await resolveCurrentOrigin();
        }

        if (isNavigationActive) {
          await stopNavigation({
            toastMessage: 'The active trip was cleared because the destination changed.',
          });
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
                    if (isNavigationActive) {
                      void stopNavigation({
                        toastMessage: 'The active trip was cleared because the origin changed.',
                      });
                    }
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
                    if (isNavigationActive) {
                      void stopNavigation({
                        toastMessage: 'The active trip was cleared because the destination changed.',
                      });
                    }
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
                        if (isNavigationActive) {
                          void stopNavigation({
                            toastMessage: 'The active trip was cleared because the destination changed.',
                          });
                        }
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

        <View style={[styles.sectionCard, styles.navigationSectionCard]}>
          <View style={styles.navigationHeader}>
            <View>
              <Text style={styles.sectionTitle}>Navigation alarm</Text>
              <Text style={styles.sectionMeta}>
                {isNavigationActive ? 'Active trip' : 'Selected route'}
              </Text>
            </View>
            {isNavigationActive ? (
              <View style={styles.navigationLiveBadge}>
                <Text style={styles.navigationLiveBadgeText}>Live</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.statusText}>
            {isNavigationActive
              ? hasTriggeredArrivalAlert
                ? 'Arrival alert already triggered for this trip.'
                : `Monitoring ${navigationTarget?.label ?? 'your stop'}${
                    backgroundMonitoringActive
                      ? ' in foreground and background.'
                      : ' while the app stays open.'
                  }`
              : selectedRoute
                ? 'Pick your alarm mode, set the radius, then start navigation on the selected route.'
                : 'Select a route first to arm the near-destination alert.'}
          </Text>
          {navigationRoute ? (
            <View style={styles.navigationSummaryCard}>
              <Text style={styles.navigationSummaryTitle}>
                {navigationRoute.recommendationLabel}
              </Text>
              <Text style={styles.navigationSummaryText}>{navigationRoute.summary}</Text>
              <Text style={styles.navigationSummaryMeta}>
                {formatDuration(navigationRoute.totalDurationMinutes)} ·{' '}
                {formatFare(navigationRoute.totalFare)}
              </Text>
            </View>
          ) : null}
          <View style={styles.navigationSettingCard}>
            <View style={styles.navigationSettingHeader}>
              <View style={styles.navigationSettingCopy}>
                <Text style={styles.navigationSettingTitle}>Near-destination alert</Text>
                <Text style={styles.navigationSettingDescription}>
                  Alerts you before your selected stop.
                </Text>
              </View>
              <Pressable
                style={[
                  styles.toggleChip,
                  nearDestinationEnabled && styles.toggleChipActive,
                ]}
                disabled={isNavigationActive}
                onPress={() => setNearDestinationEnabled((currentValue) => !currentValue)}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    nearDestinationEnabled && styles.toggleChipTextActive,
                  ]}
                >
                  {nearDestinationEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.navigationHintCompact}>
              Silent mode and Do Not Disturb can still mute sound. Vibration is best-effort.
            </Text>
          </View>
          <View style={styles.navigationOptionGroup}>
            <Text style={styles.navigationGroupTitle}>Alert style</Text>
            <View style={styles.navigationChipRow}>
              {ALARM_MODES.map((item) => (
                <Pressable
                  key={item.value}
                  style={[
                    styles.navigationChip,
                    alarmMode === item.value && styles.navigationChipActive,
                  ]}
                  disabled={isNavigationActive}
                  onPress={() => setAlarmMode(item.value)}
                >
                  <Text
                    style={[
                      styles.navigationChipText,
                      alarmMode === item.value && styles.navigationChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.navigationOptionGroup}>
            <Text style={styles.navigationGroupTitle}>Alert radius</Text>
            <View style={styles.navigationChipRow}>
              {ALERT_RADIUS_OPTIONS.map((item) => (
                <Pressable
                  key={item.value}
                  style={[
                    styles.navigationChip,
                    alertRadiusMeters === item.value && styles.navigationChipActive,
                  ]}
                  disabled={isNavigationActive}
                  onPress={() => setAlertRadiusMeters(item.value)}
                >
                  <Text
                    style={[
                      styles.navigationChipText,
                      alertRadiusMeters === item.value && styles.navigationChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {isNavigationActive ? (
            <View style={styles.navigationStatsCard}>
              <Text style={styles.navigationStatsTitle}>Live status</Text>
              <Text style={styles.navigationStatsText}>
                {navigationTarget
                  ? formatDistanceAway(distanceToTargetMeters)
                  : 'No destination target yet.'}
              </Text>
              <Text style={styles.navigationStatsMeta}>
                {backgroundMonitoringActive
                  ? 'Background alerts are armed.'
                  : 'Keep Sakai open for continuous arrival checks.'}
              </Text>
            </View>
          ) : null}
          <Pressable
            style={[
              styles.navigationButton,
              isNavigationActive ? styles.navigationButtonStop : styles.navigationButtonStart,
              ((!selectedRoute && !isNavigationActive) || isStartingNavigation) &&
                styles.navigationButtonDisabled,
            ]}
            disabled={(!selectedRoute && !isNavigationActive) || isStartingNavigation}
            onPress={() => {
              if (isNavigationActive) {
                void stopNavigation();
                return;
              }

              void startNavigation();
            }}
          >
            {isStartingNavigation ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.navigationButtonText}>
                {isNavigationActive ? 'Stop navigation' : 'Start navigation'}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.sectionCard, styles.mapSectionCard]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Map canvas</Text>
            <View style={styles.sectionTag}>
              <Text style={styles.sectionTagText}>Google Maps</Text>
            </View>
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
              {currentLocation ? (
                <Marker
                  coordinate={currentLocation}
                  pinColor={COLORS.success}
                  title="You"
                  description="Current location during navigation"
                />
              ) : null}
            </MapView>
          ) : (
            <MapSetupNotice />
          )}
        </View>

        <View style={styles.routesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggested routes</Text>
            <View style={styles.sectionTag}>
              <Text style={styles.sectionTagText}>Jeepney-first</Text>
            </View>
          </View>
          <View style={[styles.sectionCard, styles.routeStatusCard]}>
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
              onPress={() => {
                if (isNavigationActive && activeNavigationRouteId !== option.id) {
                  showToast({
                    tone: 'info',
                    title: 'Navigation active',
                    message: 'Stop the current trip before switching to another route.',
                  });
                  return;
                }

                setSelectedRouteId(option.id);
              }}
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
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: SPACING.xl, gap: SPACING.xl },
  hero: {
    backgroundColor: '#102033',
    padding: SPACING.lg,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
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
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  modeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
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
    borderRadius: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
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
    borderRadius: 12,
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
    borderRadius: 12,
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
  exampleText: { fontSize: TYPOGRAPHY.fontSizes.small, fontFamily: FONTS.medium, color: COLORS.white },
  suggestionPanel: { backgroundColor: COLORS.white, borderRadius: 6, overflow: 'hidden' },
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
  sectionCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: SPACING.sm,
  },
  sectionHeader: {
    marginHorizontal: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapSectionCard: { gap: SPACING.md },
  routesSection: {
    gap: SPACING.md,
    marginTop: -SPACING.sm,
  },
  sectionTag: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 10,
    backgroundColor: '#F6F8FB',
    borderWidth: 1,
    borderColor: '#E9EEF4',
  },
  sectionTagText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#6A7D90',
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
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navigationSectionCard: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  navigationLiveBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: 10,
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#BEE3C8',
  },
  navigationLiveBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: COLORS.success,
  },
  navigationSummaryCard: {
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  navigationSummaryTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  navigationSummaryText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#415466',
    lineHeight: 22,
  },
  navigationSummaryMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  navigationSettingCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    backgroundColor: '#FAFBFC',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  navigationSettingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  navigationSettingCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  navigationSettingTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  navigationSettingDescription: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#6A7D90',
    lineHeight: 20,
  },
  navigationOptionGroup: { gap: SPACING.md },
  navigationGroupTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  navigationHintCompact: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#6A7D90',
    lineHeight: 22,
  },
  toggleChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    backgroundColor: '#F4F8FB',
    borderWidth: 1,
    borderColor: '#D7E5EF',
  },
  toggleChipActive: {
    backgroundColor: '#102033',
    borderColor: '#102033',
  },
  toggleChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#415466',
  },
  toggleChipTextActive: { color: COLORS.white },
  navigationChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  navigationChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    backgroundColor: '#F4F8FB',
    borderWidth: 1,
    borderColor: '#D7E5EF',
  },
  navigationChipActive: {
    backgroundColor: '#102033',
    borderColor: '#102033',
  },
  navigationChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#415466',
  },
  navigationChipTextActive: { color: COLORS.white },
  navigationStatsCard: {
    borderRadius: 6,
    backgroundColor: '#FFF6EC',
    borderWidth: 1,
    borderColor: '#F5D3AA',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  navigationStatsTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: '#8A5317',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  navigationStatsText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#8A5317',
  },
  navigationStatsMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#8A5317',
    lineHeight: 20,
  },
  navigationButton: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: SPACING.xs,
  },
  navigationButtonStart: { backgroundColor: COLORS.black },
  navigationButtonStop: { backgroundColor: COLORS.danger },
  navigationButtonDisabled: { opacity: 0.55 },
  navigationButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  map: {
    width: '100%',
    height: 360,
    borderRadius: 6,
    backgroundColor: '#F7F8FA',
  },
  routeStatusCard: {
    minHeight: 76,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#657789',
    lineHeight: 22,
  },
  fallbackNote: {
    borderRadius: 6,
    backgroundColor: '#FAFBFC',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EEF2F6',
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
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: SPACING.sm,
  },
  routeCardSelected: {
    borderColor: '#102033',
  },
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
    fontFamily: FONTS.semibold,
    color: '#6A7D90',
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
    borderRadius: 6,
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
