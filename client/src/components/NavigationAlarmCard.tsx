import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import { ALERT_RADIUS_OPTIONS, formatDistanceAway } from '../navigation-alert/utils';
import RelevantIncidentsSection from './RelevantIncidentsSection';
import type { RouteQueryIncident } from '../routes/types';

const ALARM_MODES = [
  { label: 'Sound', value: 'sound' as const },
  { label: 'Vibrate', value: 'vibration' as const },
  { label: 'Both', value: 'both' as const },
];

type NavigationAlarmCardProps = {
  incidents: RouteQueryIncident[];
  isRefreshingIncidents: boolean;
  incidentRefreshFailed: boolean;
};

export default function NavigationAlarmCard({
  incidents,
  isRefreshingIncidents,
  incidentRefreshFailed,
}: NavigationAlarmCardProps) {
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

  const statusMessage = isNavigationActive
    ? hasTriggeredArrivalAlert
      ? 'Arrival alert already triggered for this trip.'
      : `Monitoring ${navigationTarget?.label ?? 'your stop'}${
          backgroundMonitoringActive ? ' in foreground and background.' : ' while the app stays open.'
        }`
    : navigationRoute
      ? 'Ready for the route you selected on Home.'
      : 'Select a route on Home first to arm the near-destination alert.';

  return (
    <View style={styles.panel}>
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>
            {isNavigationActive ? 'Active trip' : 'Selected route'}
          </Text>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
        {isNavigationActive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        ) : null}
      </View>

      {navigationRoute ? (
        <View style={styles.routeCard}>
          <Text style={styles.routeLabel}>{navigationRoute.routeLabel}</Text>
          {navigationRoute.summary.length > 0 ? (
            <Text style={styles.routeSummary}>{navigationRoute.summary}</Text>
          ) : null}
          {navigationRoute.durationLabel.length > 0 || navigationRoute.fareLabel.length > 0 ? (
            <Text style={styles.routeMeta}>
              {[navigationRoute.durationLabel, navigationRoute.fareLabel]
                .filter((value) => value.length > 0)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No route selected</Text>
          <Text style={styles.emptyStateText}>
            Pick a route on Home first, then come back here to start the arrival alarm.
          </Text>
        </View>
      )}

      <View style={styles.settingsGroup}>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Near-destination alert</Text>
            <Text style={styles.settingDescription}>Alerts you before your selected stop.</Text>
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

        <View style={styles.settingBlock}>
          <Text style={styles.groupLabel}>Alert style</Text>
          <View style={styles.optionRow}>
            {ALARM_MODES.map((item) => (
              <Pressable
                key={item.value}
                style={[styles.optionChip, alarmMode === item.value && styles.optionChipActive]}
                disabled={isNavigationActive}
                onPress={() => setAlarmMode(item.value)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    alarmMode === item.value && styles.optionChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.settingBlock}>
          <Text style={styles.groupLabel}>Alert radius</Text>
          <View style={styles.optionRow}>
            {ALERT_RADIUS_OPTIONS.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.optionChip,
                  alertRadiusMeters === item.value && styles.optionChipActive,
                ]}
                disabled={isNavigationActive}
                onPress={() => setAlertRadiusMeters(item.value)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    alertRadiusMeters === item.value && styles.optionChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.helperText}>
          Silent mode and Do Not Disturb can still mute sound. Vibration is best-effort.
        </Text>
      </View>

      {isNavigationActive ? (
        <View style={styles.liveStatusCard}>
          <Text style={styles.liveStatusLabel}>Live status</Text>
          <Text style={styles.liveStatusValue}>
            {navigationTarget ? formatDistanceAway(distanceToTargetMeters) : 'No destination target yet.'}
          </Text>
          <Text style={styles.liveStatusMeta}>
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

      {navigationRoute ? (
        <RelevantIncidentsSection
          incidents={incidents}
          title="Route updates"
          compact={true}
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
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E5ECF2',
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  topCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  eyebrow: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#7B8A97',
  },
  liveBadge: {
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: '#EAF6EE',
    borderWidth: 1,
    borderColor: '#C8E3D0',
  },
  liveBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.success,
  },
  routeCard: {
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E6EDF4',
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  routeLabel: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
  },
  routeSummary: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5C6D7C',
    lineHeight: 20,
  },
  routeMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  emptyState: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF4',
    backgroundColor: '#FBFCFD',
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  emptyStateTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
  },
  emptyStateText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
  },
  settingsGroup: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF4',
    backgroundColor: '#FBFCFD',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  settingCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  settingTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
  },
  settingDescription: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
  },
  settingBlock: {
    gap: SPACING.sm,
  },
  groupLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
  },
  toggleChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D8E2EB',
  },
  toggleChipActive: {
    backgroundColor: COLORS.midnight,
    borderColor: COLORS.midnight,
  },
  toggleChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#435564',
  },
  toggleChipTextActive: {
    color: COLORS.white,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 1,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D8E2EB',
    minWidth: 76,
    alignItems: 'center',
  },
  optionChipActive: {
    backgroundColor: COLORS.midnight,
    borderColor: COLORS.midnight,
  },
  optionChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#5A6C7C',
  },
  optionChipTextActive: {
    color: COLORS.white,
  },
  liveStatusCard: {
    borderRadius: RADIUS.md,
    backgroundColor: '#FFF7EE',
    borderWidth: 1,
    borderColor: '#F5DEC0',
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  liveStatusLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#8A5317',
  },
  liveStatusValue: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: '#8A5317',
  },
  liveStatusMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#8A5317',
    lineHeight: 20,
  },
  navigationButton: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
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
    color: '#576978',
    lineHeight: 22,
  },
});
