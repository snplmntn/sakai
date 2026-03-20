import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS, FONTS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import { ALERT_RADIUS_OPTIONS, formatDistanceAway } from '../navigation-alert/utils';
import RelevantIncidentsSection from './RelevantIncidentsSection';
import { queryRelevantAreaUpdates } from '../routes/api';
import type { RouteQueryIncident } from '../routes/types';

const ALARM_MODES = [
  { label: 'Sound', value: 'sound' as const },
  { label: 'Vibrate', value: 'vibration' as const },
  { label: 'Both', value: 'both' as const },
];

export default function NavigationAlarmCard() {
  const {
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
    startNavigation,
    stopNavigation,
  } = useNavigationAlarm();
  const [incidents, setIncidents] = useState<RouteQueryIncident[]>(navigationRoute?.relevantIncidents ?? []);
  const [isRefreshingIncidents, setIsRefreshingIncidents] = useState(false);
  const [incidentRefreshFailed, setIncidentRefreshFailed] = useState(false);

  useEffect(() => {
    setIncidents(navigationRoute?.relevantIncidents ?? []);
    setIncidentRefreshFailed(false);
  }, [navigationRoute]);

  const refreshIncidents = useCallback(async () => {
    if (
      !navigationRoute ||
      navigationRoute.originLabel.length === 0 ||
      navigationRoute.destinationLabel.length === 0
    ) {
      return;
    }

    setIsRefreshingIncidents(true);

    try {
      const latestIncidents = await queryRelevantAreaUpdates({
        corridorTags: navigationRoute.corridorTags,
        originLabel: navigationRoute.originLabel,
        destinationLabel: navigationRoute.destinationLabel,
        limit: 3,
      });

      setIncidents(latestIncidents);
      setIncidentRefreshFailed(false);
    } catch {
      setIncidentRefreshFailed(true);
    } finally {
      setIsRefreshingIncidents(false);
    }
  }, [navigationRoute]);

  useFocusEffect(
    useCallback(() => {
      void refreshIncidents();
    }, [refreshIncidents])
  );

  const statusMessage = isNavigationActive
    ? hasTriggeredArrivalAlert
      ? 'Arrival alert already triggered for this trip.'
      : `Monitoring ${navigationTarget?.label ?? 'your stop'}${
          backgroundMonitoringActive ? ' in foreground and background.' : ' while the app stays open.'
        }`
    : navigationRoute
      ? 'Pick your alarm mode, set the radius, then start navigation on the selected route.'
      : 'Select a route on Home first to arm the near-destination alert.';

  return (
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

      <Text style={styles.statusText}>{statusMessage}</Text>

      {navigationRoute ? (
        <View style={styles.navigationSummaryCard}>
          <Text style={styles.navigationSummaryTitle}>{navigationRoute.routeLabel}</Text>
          {navigationRoute.summary.length > 0 ? (
            <Text style={styles.navigationSummaryText}>{navigationRoute.summary}</Text>
          ) : null}
          {navigationRoute.durationLabel.length > 0 || navigationRoute.fareLabel.length > 0 ? (
            <Text style={styles.navigationSummaryMeta}>
              {[navigationRoute.durationLabel, navigationRoute.fareLabel]
                .filter((value) => value.length > 0)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {navigationRoute ? (
        <RelevantIncidentsSection
          incidents={incidents}
          title="Route area updates"
          metaNotice={
            isRefreshingIncidents
              ? 'Refreshing MMDA updates for this route...'
              : incidentRefreshFailed
                ? 'Showing the latest saved route snapshot because refresh is unavailable right now.'
                : 'Only MMDA updates relevant to this route are shown here.'
          }
          emptyText="No active MMDA area updates are affecting this route right now."
        />
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
            style={[styles.toggleChip, nearDestinationEnabled && styles.toggleChipActive]}
            disabled={isNavigationActive}
            onPress={() => setNearDestinationEnabled(!nearDestinationEnabled)}
          >
            <Text
              style={[styles.toggleChipText, nearDestinationEnabled && styles.toggleChipTextActive]}
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
              style={[styles.navigationChip, alarmMode === item.value && styles.navigationChipActive]}
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
            {navigationTarget ? formatDistanceAway(distanceToTargetMeters) : 'No destination target yet.'}
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
          ((!navigationRoute && !isNavigationActive) || isStartingNavigation) &&
            styles.navigationButtonDisabled,
        ]}
        disabled={(!navigationRoute && !isNavigationActive) || isStartingNavigation}
        onPress={() => {
          void (isNavigationActive ? stopNavigation() : startNavigation());
        }}
      >
        <Text style={styles.navigationButtonText}>
          {isStartingNavigation
            ? 'Starting navigation...'
            : isNavigationActive
              ? 'Stop navigation'
              : 'Start navigation'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: SPACING.sm,
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
  navigationOptionGroup: {
    gap: SPACING.md,
  },
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
  toggleChipTextActive: {
    color: COLORS.white,
  },
  navigationChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
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
  navigationChipTextActive: {
    color: COLORS.white,
  },
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
  navigationButtonStart: {
    backgroundColor: COLORS.black,
  },
  navigationButtonStop: {
    backgroundColor: COLORS.danger,
  },
  navigationButtonDisabled: {
    opacity: 0.55,
  },
  navigationButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#657789',
    lineHeight: 22,
  },
});
