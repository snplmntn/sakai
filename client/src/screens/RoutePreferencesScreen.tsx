import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { usePreferences } from '../preferences/PreferencesContext';
import type { RoutePreference } from '../preferences/types';
import { useToast } from '../toast/ToastContext';

const OPTIONS: Array<{ key: RoutePreference; label: string; description: string }> = [
  { key: 'balanced', label: 'Balanced', description: 'Mix time and fare for everyday commuting.' },
  { key: 'fastest', label: 'Fastest', description: 'Prioritize shorter travel time.' },
  { key: 'cheapest', label: 'Cheapest', description: 'Prioritize lower fare.' },
];

export default function RoutePreferencesScreen() {
  const { preferences, updatePreferences, isUpdating } = usePreferences();
  const { showToast } = useToast();

  const handleSelect = async (nextPreference: RoutePreference) => {
    try {
      await updatePreferences({
        defaultPreference: nextPreference,
        passengerType: preferences.passengerType,
        routeModifiers: preferences.routeModifiers,
        voiceLanguage: preferences.voiceLanguage,
        commuteModes: preferences.commuteModes,
        allowCarAccess: preferences.allowCarAccess,
      });
      showToast({ tone: 'success', message: 'Route preference updated.' });
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update your route preference.',
      });
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.white} topInsetBackgroundColor={COLORS.white} statusBarStyle="dark">
      <View style={styles.container}>
        <Text style={styles.title}>Route preferences</Text>
        <Text style={styles.subtitle}>Set your default route ranking for new searches.</Text>

        <View style={styles.list}>
          {OPTIONS.map((option) => {
            const selected = preferences.defaultPreference === option.key;

            return (
              <Pressable
                key={option.key}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => {
                  void handleSelect(option.key);
                }}
                disabled={isUpdating}
              >
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{option.label}</Text>
                  <Text style={styles.cardDescription}>{option.description}</Text>
                </View>
                {isUpdating && selected ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <View style={[styles.pill, selected && styles.pillSelected]}>
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                      {selected ? 'Selected' : 'Choose'}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
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
  list: {
    gap: SPACING.md,
  },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F4F9FF',
  },
  cardCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  cardDescription: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 18,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  pillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  pillText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.subText,
  },
  pillTextSelected: {
    color: COLORS.white,
  },
});
