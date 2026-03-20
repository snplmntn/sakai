import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import {
  PASSENGER_TYPE_OPTIONS,
  ROUTE_MODIFIER_OPTIONS,
  ROUTE_PREFERENCE_OPTIONS,
} from '../preferences/types';
import type { PassengerType, RouteModifier, RoutePreference } from '../preferences/types';
import { usePreferences } from '../preferences/PreferencesContext';
import { useToast } from '../toast/ToastContext';
import { VOICE_LANGUAGE_OPTIONS, type VoiceLanguagePreference } from '../voice/languages';

export default function PreferencesScreen() {
  const { preferences, updatePreferences, isUpdating } = usePreferences();
  const { showToast } = useToast();

  const handlePreferenceSelect = async (defaultPreference: RoutePreference) => {
    try {
      await updatePreferences({
        defaultPreference,
        passengerType: preferences.passengerType,
        routeModifiers: preferences.routeModifiers,
        voiceLanguage: preferences.voiceLanguage,
      });
      showToast({ tone: 'success', message: 'Preferences updated.' });
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update your preferences.',
      });
    }
  };

  const handlePassengerTypeSelect = async (passengerType: PassengerType) => {
    try {
      await updatePreferences({
        defaultPreference: preferences.defaultPreference,
        passengerType,
        routeModifiers: preferences.routeModifiers,
        voiceLanguage: preferences.voiceLanguage,
      });
      showToast({ tone: 'success', message: 'Preferences updated.' });
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update your preferences.',
      });
    }
  };

  const handleModifierToggle = async (modifier: RouteModifier) => {
    const routeModifiers = preferences.routeModifiers.includes(modifier)
      ? preferences.routeModifiers.filter((value) => value !== modifier)
      : [...preferences.routeModifiers, modifier];

    try {
      await updatePreferences({
        defaultPreference: preferences.defaultPreference,
        passengerType: preferences.passengerType,
        routeModifiers,
        voiceLanguage: preferences.voiceLanguage,
      });
      showToast({ tone: 'success', message: 'Preferences updated.' });
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update your preferences.',
      });
    }
  };

  const handleVoiceLanguageSelect = async (voiceLanguage: VoiceLanguagePreference) => {
    try {
      await updatePreferences({
        defaultPreference: preferences.defaultPreference,
        passengerType: preferences.passengerType,
        routeModifiers: preferences.routeModifiers,
        voiceLanguage,
      });
      showToast({ tone: 'success', message: 'Preferences updated.' });
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update your preferences.',
      });
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.white} topInsetBackgroundColor={COLORS.white} statusBarStyle="dark">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Preferences</Text>
          <Text style={styles.subtitle}>
            Change the defaults Sakai uses for ranking and fare estimates.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route preference</Text>
          <View style={styles.list}>
            {ROUTE_PREFERENCE_OPTIONS.map((option) => {
              const selected = preferences.defaultPreference === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => {
                    void handlePreferenceSelect(option.value);
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Passenger profile</Text>
          <View style={styles.grid}>
            {PASSENGER_TYPE_OPTIONS.map((option) => {
              const selected = preferences.passengerType === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.gridCard, selected && styles.cardSelected]}
                  onPress={() => {
                    void handlePassengerTypeSelect(option.value);
                  }}
                  disabled={isUpdating}
                >
                  <View style={styles.gridHeader}>
                    <Text style={styles.gridTitle}>{option.label}</Text>
                    {isUpdating && selected ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <View style={[styles.dot, selected && styles.dotSelected]} />
                    )}
                  </View>
                  <Text style={styles.gridDescription}>{option.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip modifiers</Text>
          <View style={styles.modifierRow}>
            {ROUTE_MODIFIER_OPTIONS.map((option) => {
              const selected = preferences.routeModifiers.includes(option.value);

              return (
                <Pressable
                  key={option.value}
                  style={[styles.modifierChip, selected && styles.modifierChipSelected]}
                  onPress={() => {
                    void handleModifierToggle(option.value);
                  }}
                  disabled={isUpdating}
                >
                  <Text style={[styles.modifierTitle, selected && styles.modifierTitleSelected]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.modifierDescription,
                      selected && styles.modifierDescriptionSelected,
                    ]}
                  >
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice language</Text>
          <View style={styles.list}>
            {VOICE_LANGUAGE_OPTIONS.map((option) => {
              const selected = preferences.voiceLanguage === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => {
                    void handleVoiceLanguageSelect(option.value);
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
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  header: {
    gap: SPACING.xs,
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
    lineHeight: 18,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
  },
  list: {
    gap: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F4F9FF',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  cardDescription: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 15,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  pillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  pillText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.subText,
  },
  pillTextSelected: {
    color: COLORS.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  gridCard: {
    width: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  gridTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  gridDescription: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 15,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C8D5E0',
    backgroundColor: COLORS.white,
  },
  dotSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  modifierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  modifierChip: {
    flex: 1,
    minWidth: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    gap: 2,
  },
  modifierChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F4F9FF',
  },
  modifierTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  modifierTitleSelected: {
    color: COLORS.primary,
  },
  modifierDescription: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 15,
  },
  modifierDescriptionSelected: {
    color: '#42617C',
  },
});
