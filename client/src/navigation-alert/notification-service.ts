import { Platform } from 'react-native';

import {
  NEAR_DESTINATION_BOTH_CHANNEL,
  NEAR_DESTINATION_SOUND_CHANNEL,
  NEAR_DESTINATION_VIBRATION_CHANNEL,
} from './task';

const ALERT_VIBRATION_PATTERN: number[] = [0, 250, 200, 250, 200, 400];

type NotificationApi = typeof import('expo-notifications');

type NotificationRuntime = {
  supported: boolean;
  api: NotificationApi | null;
};

type ExecutionEnvironment = string | null;

let cachedRuntime: Promise<NotificationRuntime> | null = null;

const readExecutionEnvironment = (value: unknown): ExecutionEnvironment => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if ('executionEnvironment' in value && typeof (value as { executionEnvironment?: unknown }).executionEnvironment === 'string') {
    return (value as { executionEnvironment?: unknown }).executionEnvironment as string;
  }

  return null;
};

const getRuntime = async (): Promise<NotificationRuntime> => {
  if (cachedRuntime) {
    return cachedRuntime;
  }

  cachedRuntime = (async () => {
    let notificationsApi: NotificationApi | null = null;
    let executionEnvironment: ExecutionEnvironment = null;
    let constantsModule: unknown = null;

    try {
      constantsModule = await import('expo-constants');
      executionEnvironment =
        readExecutionEnvironment(constantsModule) ??
        readExecutionEnvironment((constantsModule as { default?: unknown }).default ?? null);
    } catch (error) {
      console.warn('Notification runtime constants are not available.', error);
    }

    const isExpoGo = executionEnvironment === 'storeClient';
    if (!isExpoGo) {
      try {
        notificationsApi = await import('expo-notifications');
      } catch (error) {
        console.warn('Notification runtime APIs are not available.', error);
      }
    }

    if (isExpoGo) {
      console.info(
        'Navigation alerts are disabled in Expo Go. Use a development build to enable near-destination alarms.'
      );
    }

    return {
      api: isExpoGo ? null : notificationsApi,
      supported: !isExpoGo && notificationsApi !== null,
    };
  })();

  return cachedRuntime;
};

export const resetNotificationRuntime = (): void => {
  cachedRuntime = null;
};

export const getNotificationAlertPattern = (): number[] => [...ALERT_VIBRATION_PATTERN];

export const getNotificationSupport = async (): Promise<boolean> => {
  const runtime = await getRuntime();
  return runtime.supported && runtime.api !== null;
};

export const configureArrivalNotifications = async (): Promise<boolean> => {
  const runtime = await getRuntime();

  if (!runtime.supported || runtime.api === null) {
    return false;
  }

  try {
    runtime.api.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await runtime.api.setNotificationChannelAsync(NEAR_DESTINATION_SOUND_CHANNEL, {
        name: 'Near destination sound',
        importance: runtime.api.AndroidImportance.MAX,
        sound: 'default',
        enableVibrate: false,
        lockscreenVisibility: runtime.api.AndroidNotificationVisibility.PUBLIC,
      });
      await runtime.api.setNotificationChannelAsync(NEAR_DESTINATION_VIBRATION_CHANNEL, {
        name: 'Near destination vibration',
        importance: runtime.api.AndroidImportance.MAX,
        sound: null,
        enableVibrate: true,
        vibrationPattern: ALERT_VIBRATION_PATTERN,
        lockscreenVisibility: runtime.api.AndroidNotificationVisibility.PUBLIC,
      });
      await runtime.api.setNotificationChannelAsync(NEAR_DESTINATION_BOTH_CHANNEL, {
        name: 'Near destination alarm',
        importance: runtime.api.AndroidImportance.MAX,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: ALERT_VIBRATION_PATTERN,
        lockscreenVisibility: runtime.api.AndroidNotificationVisibility.PUBLIC,
      });
    }

    return true;
  } catch (error) {
    console.warn('Unable to configure arrival notifications', error);
    return false;
  }
};

export const requestArrivalNotificationPermission = async (): Promise<boolean> => {
  const runtime = await getRuntime();
  if (!runtime.supported || runtime.api === null) {
    return false;
  }

  try {
    const permission = await runtime.api.requestPermissionsAsync();
    return permission.status === 'granted';
  } catch (error) {
    console.warn('Unable to check arrival notification permissions', error);
    return false;
  }
};

export const scheduleArrivalNotification = async (params: {
  routeId: string | null;
  targetLabel: string;
  alertRadiusMeters: number;
  alarmMode: 'sound' | 'vibration' | 'both';
}): Promise<boolean> => {
  const runtime = await getRuntime();
  if (!runtime.supported || runtime.api === null) {
    return false;
  }

  const channelId =
    params.alarmMode === 'sound'
      ? NEAR_DESTINATION_SOUND_CHANNEL
      : params.alarmMode === 'vibration'
        ? NEAR_DESTINATION_VIBRATION_CHANNEL
        : NEAR_DESTINATION_BOTH_CHANNEL;

  try {
    await runtime.api.scheduleNotificationAsync({
      content: {
        title: 'Near your stop',
        body: `You are within ${params.alertRadiusMeters} meters of ${params.targetLabel}.`,
        data: {
          type: 'near-destination-alert',
          routeId: params.routeId,
        },
        sound: params.alarmMode === 'vibration' ? false : 'default',
        vibrate:
          params.alarmMode === 'sound' ? undefined : ALERT_VIBRATION_PATTERN,
        priority: runtime.api.AndroidNotificationPriority.MAX,
      },
      trigger:
        Platform.OS === 'android'
          ? { channelId }
          : null,
    });
    return true;
  } catch (error) {
    console.warn('Unable to show arrival notification', error);
    return false;
  }
};
