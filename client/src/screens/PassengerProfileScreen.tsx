import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { usePreferences } from '../preferences/PreferencesContext';
import type { PassengerType } from '../preferences/types';
import { useToast } from '../toast/ToastContext';

const OPTIONS: Array<{ key: PassengerType; label: string; description: string }> = [
  { key: 'regular', label: 'Regular', description: 'Standard fare profile.' },
  { key: 'student', label: 'Student', description: 'Apply student fare discounts where supported.' },
  { key: 'senior', label: 'Senior', description: 'Apply senior fare discounts where supported.' },
  { key: 'pwd', label: 'PWD', description: 'Apply PWD fare discounts where supported.' },
];

export default function PassengerProfileScreen() {
  const { preferences, updatePreferences, isUpdating } = usePreferences();
  const { showToast } = useToast();

  const handleSelect = async (nextPassengerType: PassengerType) => {
    try {
      await updatePreferences({
        defaultPreference: preferences.defaultPreference,
        passengerType: nextPassengerType,
        routeModifiers: preferences.routeModifiers,
      });
      showToast({ tone: 'success', message: 'Passenger profile updated.' });
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update your passenger profile.',
      });
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.white} topInsetBackgroundColor={COLORS.white} statusBarStyle="dark">
      <View style={styles.container}>
        <Text style={styles.title}>Passenger profile</Text>
        <Text style={styles.subtitle}>Choose the rider type Sakai should use for fare calculations.</Text>

        <View style={styles.list}>
          {OPTIONS.map((option) => {
            const selected = preferences.passengerType === option.key;

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
