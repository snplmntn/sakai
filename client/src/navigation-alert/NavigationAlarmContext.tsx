import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Vibration } from 'react-native';
import * as Location from 'expo-location';

import {
  clearActiveNavigationSession,
  readActiveNavigationSession,
  writeActiveNavigationSession,
} from './storage';
import {
  ALERT_RADIUS_OPTIONS,
  calculateDistanceMeters,
} from './utils';
import {
  getNotificationAlertPattern,
  requestArrivalNotificationPermission,
  scheduleArrivalNotification,
} from './notification-service';
import { NEAR_DESTINATION_LOCATION_TASK } from './task';
import type {
  AlarmMode,
  AlertRadiusMeters,
  NavigationRouteCandidate,
  NavigationTarget,
} from './types';
import { useToast } from '../toast/ToastContext';

interface NavigationAlarmContextValue {
  activeNavigationRouteId: string | null;
  alertRadiusMeters: AlertRadiusMeters;
  alarmMode: AlarmMode;
  backgroundMonitoringActive: boolean;
  distanceToTargetMeters: number | null;
  hasTriggeredArrivalAlert: boolean;
  isNavigationActive: boolean;
  isStartingNavigation: boolean;
  nearDestinationEnabled: boolean;
  navigationRoute: NavigationRouteCandidate | null;
  navigationTarget: NavigationTarget | null;
  setAlertRadiusMeters: (value: AlertRadiusMeters) => void;
  setAlarmMode: (value: AlarmMode) => void;
  setNearDestinationEnabled: (value: boolean) => void;
  setNavigationCandidate: (value: NavigationRouteCandidate | null) => void;
  startNavigation: () => Promise<void>;
  stopNavigation: () => Promise<void>;
}

const NavigationAlarmContext = createContext<NavigationAlarmContextValue | undefined>(undefined);

const ALERT_VIBRATION_PATTERN = getNotificationAlertPattern();

const createSessionRouteCandidate = (
  session: {
    routeId: string;
    routeLabel: string;
    summary: string;
    durationLabel: string;
    fareLabel: string;
    originLabel: string;
    destinationLabel: string;
    corridorTags: string[];
    relevantIncidents: NavigationRouteCandidate['relevantIncidents'];
    destination: NavigationTarget;
  }
): NavigationRouteCandidate => ({
  routeId: session.routeId,
  routeLabel: session.routeLabel,
  summary: session.summary,
  durationLabel: session.durationLabel,
  fareLabel: session.fareLabel,
  originLabel: session.originLabel,
  destinationLabel: session.destinationLabel,
  corridorTags: session.corridorTags,
  relevantIncidents: session.relevantIncidents,
  destination: session.destination,
});

export function NavigationAlarmProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const foregroundLocationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const hasTriggeredArrivalAlertRef = useRef(false);

  const [activeNavigationRouteId, setActiveNavigationRouteId] = useState<string | null>(null);
  const [navigationCandidate, setNavigationCandidate] = useState<NavigationRouteCandidate | null>(
    null
  );
  const [activeNavigationRoute, setActiveNavigationRoute] =
    useState<NavigationRouteCandidate | null>(null);
  const [nearDestinationEnabled, setNearDestinationEnabled] = useState(true);
  const [alarmMode, setAlarmMode] = useState<AlarmMode>('both');
  const [alertRadiusMeters, setAlertRadiusMeters] = useState<AlertRadiusMeters>(
    ALERT_RADIUS_OPTIONS[1]?.value ?? 300
  );
  const [isStartingNavigation, setIsStartingNavigation] = useState(false);
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  const [distanceToTargetMeters, setDistanceToTargetMeters] = useState<number | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | null>(null);
  const [hasTriggeredArrivalAlert, setHasTriggeredArrivalAlert] = useState(false);
  const [backgroundMonitoringActive, setBackgroundMonitoringActive] = useState(false);

  const navigationRoute = isNavigationActive ? activeNavigationRoute : navigationCandidate;

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
        hasTriggeredArrivalAlertRef.current = false;
        setHasTriggeredArrivalAlert(false);
        setIsNavigationActive(true);
        setActiveNavigationRouteId(storedSession.routeId);
        setActiveNavigationRoute(createSessionRouteCandidate(storedSession));
        setNavigationTarget(storedSession.destination);
        setAlarmMode(storedSession.alarmMode);
        setAlertRadiusMeters(storedSession.alertRadiusMeters);
        setNearDestinationEnabled(storedSession.nearDestinationEnabled);
        setBackgroundMonitoringActive(true);
      } else if (storedSession) {
        await clearActiveNavigationSession();
      } else if (hasBackgroundUpdates) {
        await Location.stopLocationUpdatesAsync(NEAR_DESTINATION_LOCATION_TASK).catch(
          (error: unknown) => {
            console.warn('Unable to stop orphaned background location updates', error);
          }
        );
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNavigationActive || !activeNavigationRouteId || !navigationCandidate) {
      return;
    }

    if (navigationCandidate.routeId === activeNavigationRouteId) {
      setActiveNavigationRoute(navigationCandidate);
    }
  }, [activeNavigationRouteId, isNavigationActive, navigationCandidate]);

  useEffect(() => {
    return () => {
      foregroundLocationSubscriptionRef.current?.remove();
      foregroundLocationSubscriptionRef.current = null;
    };
  }, []);

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

  const stopNavigationInternal = async (options?: {
    preserveTriggeredState?: boolean;
    toastMessage?: string;
  }): Promise<void> => {
    foregroundLocationSubscriptionRef.current?.remove();
    foregroundLocationSubscriptionRef.current = null;

    await stopBackgroundMonitoring();
    await clearActiveNavigationSession();

    setIsNavigationActive(false);
    setActiveNavigationRouteId(null);
    setActiveNavigationRoute(null);
    setNavigationTarget(null);
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

  const triggerArrivalAlert = async (
    target: NavigationTarget,
    routeId: string,
    selectedAlarmMode: AlarmMode,
    selectedAlertRadiusMeters: AlertRadiusMeters
  ): Promise<void> => {
    if (hasTriggeredArrivalAlertRef.current) {
      return;
    }

    hasTriggeredArrivalAlertRef.current = true;
    setHasTriggeredArrivalAlert(true);

    if (selectedAlarmMode !== 'sound') {
      Vibration.vibrate(ALERT_VIBRATION_PATTERN);
    }

    showToast({
      tone: 'success',
      title: 'Near your stop',
      message: `You are within ${selectedAlertRadiusMeters} meters of ${target.label}.`,
      durationMs: 5000,
    });

    const hasNotification = await scheduleArrivalNotification({
      routeId,
      targetLabel: target.label,
      alertRadiusMeters: selectedAlertRadiusMeters,
      alarmMode: selectedAlarmMode,
    });

    if (!hasNotification) {
      console.info('Navigation alert delivered with vibration/toast only.');
    }

    await stopNavigationInternal({ preserveTriggeredState: true });
  };

  const handleLiveLocationUpdate = async (input: {
    location: { latitude: number; longitude: number };
    routeId: string;
    shouldTriggerAlert: boolean;
    target: NavigationTarget;
    selectedAlarmMode: AlarmMode;
    selectedAlertRadiusMeters: AlertRadiusMeters;
  }): Promise<void> => {
    const distanceMeters = calculateDistanceMeters(input.location, input.target);
    setDistanceToTargetMeters(distanceMeters);

    if (
      input.shouldTriggerAlert &&
      distanceMeters <= input.selectedAlertRadiusMeters &&
      !hasTriggeredArrivalAlertRef.current
    ) {
      await triggerArrivalAlert(
        input.target,
        input.routeId,
        input.selectedAlarmMode,
        input.selectedAlertRadiusMeters
      );
    }
  };

  const startNavigation = async (): Promise<void> => {
    const route = navigationCandidate;

    if (!route) {
      showToast({
        tone: 'info',
        title: 'Pick a route first',
        message: 'Select a route on Home before starting navigation mode.',
      });
      return;
    }

    const selectedAlarmMode = alarmMode;
    const selectedAlertRadiusMeters = alertRadiusMeters;
    const selectedNearDestinationEnabled = nearDestinationEnabled;

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
      hasTriggeredArrivalAlertRef.current = false;
      setHasTriggeredArrivalAlert(false);
      setIsNavigationActive(true);
      setActiveNavigationRouteId(route.routeId);
      setActiveNavigationRoute(route);
      setNavigationTarget(route.destination);
      setDistanceToTargetMeters(null);

      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const initialCoordinate = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      };
      const initialDistanceMeters = calculateDistanceMeters(initialCoordinate, route.destination);

      setDistanceToTargetMeters(initialDistanceMeters);

      if (selectedNearDestinationEnabled && initialDistanceMeters <= selectedAlertRadiusMeters) {
        await triggerArrivalAlert(
          route.destination,
          route.routeId,
          selectedAlarmMode,
          selectedAlertRadiusMeters
        );
        return;
      }

      foregroundLocationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 12000,
          distanceInterval: 40,
        },
        (location) => {
          void handleLiveLocationUpdate({
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            routeId: route.routeId,
            shouldTriggerAlert: selectedNearDestinationEnabled,
            target: route.destination,
            selectedAlarmMode,
            selectedAlertRadiusMeters,
          });
        }
      );

      if (selectedNearDestinationEnabled) {
        const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
        const backgroundGranted = backgroundPermission.status === 'granted';

        if (backgroundGranted && canNotify) {
          await writeActiveNavigationSession({
            routeId: route.routeId,
            routeLabel: route.routeLabel,
            summary: route.summary,
            durationLabel: route.durationLabel,
            fareLabel: route.fareLabel,
            originLabel: route.originLabel,
            destinationLabel: route.destinationLabel,
            corridorTags: route.corridorTags,
            relevantIncidents: route.relevantIncidents,
            destination: route.destination,
            alertRadiusMeters: selectedAlertRadiusMeters,
            alarmMode: selectedAlarmMode,
            nearDestinationEnabled: selectedNearDestinationEnabled,
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
              notificationBody: `Watching for arrival near ${route.destination.label}.`,
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
      await stopNavigationInternal();
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

  const stopNavigation = async (): Promise<void> => {
    await stopNavigationInternal();
  };

  return (
    <NavigationAlarmContext.Provider
      value={{
        activeNavigationRouteId,
        alertRadiusMeters,
        alarmMode,
        backgroundMonitoringActive,
        distanceToTargetMeters,
        hasTriggeredArrivalAlert,
        isNavigationActive,
        isStartingNavigation,
        nearDestinationEnabled,
        navigationRoute,
        navigationTarget,
        setAlertRadiusMeters,
        setAlarmMode,
        setNearDestinationEnabled,
        setNavigationCandidate,
        startNavigation,
        stopNavigation,
      }}
    >
      {children}
    </NavigationAlarmContext.Provider>
  );
}

export const useNavigationAlarm = (): NavigationAlarmContextValue => {
  const contextValue = useContext(NavigationAlarmContext);

  if (!contextValue) {
    throw new Error('useNavigationAlarm must be used within a NavigationAlarmProvider');
  }

  return contextValue;
};
