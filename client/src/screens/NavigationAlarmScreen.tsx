import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import NavigationAlarmCard from '../components/NavigationAlarmCard';
import SafeScreen from '../components/SafeScreen';
import { COLORS, SPACING } from '../constants/theme';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import { queryRelevantAreaUpdates } from '../routes/api';
import type { RouteQueryIncident } from '../routes/types';

export default function NavigationAlarmScreen() {
  const { navigationRoute } = useNavigationAlarm();
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
      setIncidentRefreshFailed(false);
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

  return (
    <SafeScreen backgroundColor={COLORS.white} topInsetBackgroundColor={COLORS.white} statusBarStyle="dark">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshingIncidents} onRefresh={() => void refreshIncidents()} />
        }
      >
        <View style={styles.body}>
          <NavigationAlarmCard
            incidents={incidents}
            isRefreshingIncidents={isRefreshingIncidents}
            incidentRefreshFailed={incidentRefreshFailed}
          />
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SPACING.xxl,
  },
  body: {
    padding: SPACING.lg,
  },
});
