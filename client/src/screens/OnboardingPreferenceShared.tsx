import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { PassengerType, RoutePreference } from '../preferences/types';

export const ROUTE_PREFERENCE_OPTIONS: Array<{
  value: RoutePreference;
  title: string;
  description: string;
}> = [
  {
    value: 'balanced',
    title: 'Balanced',
    description: 'Mix time, transfers, and fare.',
  },
  {
    value: 'cheapest',
    title: 'Cheapest',
    description: 'Favor lower fares.',
  },
  {
    value: 'fastest',
    title: 'Fastest',
    description: 'Favor shorter travel time.',
  },
] as const;

export const PASSENGER_TYPE_OPTIONS: Array<{
  value: PassengerType;
  title: string;
  description: string;
}> = [
  {
    value: 'regular',
    title: 'Regular',
    description: 'Standard fare.',
  },
  {
    value: 'student',
    title: 'Student',
    description: 'Student discount when supported.',
  },
  {
    value: 'senior',
    title: 'Senior',
    description: 'Senior discount when supported.',
  },
  {
    value: 'pwd',
    title: 'PWD',
    description: 'PWD discount when supported.',
  },
] as const;

interface OnboardingPreferencesLayoutProps {
  title: string;
  subtitle: string;
  activeStep: 0 | 1;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const STEP_COUNT = 2;

export function OnboardingPreferencesLayout({
  title,
  subtitle,
  activeStep,
  onBack,
  children,
  footer,
}: OnboardingPreferencesLayoutProps) {
  return (
    <SafeScreen backgroundColor={COLORS.surface} topInsetBackgroundColor={COLORS.surface}>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.stepperRow}>
            {Array.from({ length: STEP_COUNT }, (_, index) => (
              <View
                key={index}
                style={[styles.stepperSegment, index === activeStep && styles.stepperSegmentActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.body}>{children}</View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </SafeScreen>
  );
}

export const preferenceStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  optionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F4F9FF',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  optionTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  optionTitleSelected: {
    color: COLORS.primary,
  },
  optionDescription: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
  },
  optionDescriptionSelected: {
    color: '#42617C',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  passengerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  passengerCard: {
    width: '48%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
  },
  passengerCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F4F9FF',
  },
  passengerTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  passengerTitleSelected: {
    color: COLORS.primary,
  },
  passengerDescription: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 18,
  },
  passengerDescriptionSelected: {
    color: '#42617C',
  },
  footerNote: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  primaryButton: {
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
    paddingRight: SPACING.md,
    marginBottom: SPACING.xl,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.subText,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.title,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 24,
  },
  stepperSegment: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(16,32,51,0.12)',
  },
  stepperSegmentActive: {
    backgroundColor: COLORS.primary,
  },
  body: {
    flexGrow: 1,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: SPACING.xl,
  },
});
