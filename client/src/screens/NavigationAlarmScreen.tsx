import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import NavigationAlarmCard from '../components/NavigationAlarmCard';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useNavigationAlarm } from '../navigation-alert/NavigationAlarmContext';
import { queryRelevantAreaUpdates } from '../routes/api';
import type { RouteQueryIncident } from '../routes/types';

type NavigationAlarmScreenProps = NativeStackScreenProps<RootStackParamList, 'NavigationAlarm'>;

export default function NavigationAlarmScreen({ navigation }: NavigationAlarmScreenProps) {
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
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.midnight} />
            </Pressable>
            <Text style={styles.title}>Navigation alarm</Text>
            <Text style={styles.subtitle}>
              Manage your near-destination alert with simple trip-ready defaults.
            </Text>
          </View>
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
    gap: SPACING.md,
  },
  header: {
    gap: SPACING.xs,
    paddingTop: SPACING.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E3EBF2',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.midnight,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
  },
});
