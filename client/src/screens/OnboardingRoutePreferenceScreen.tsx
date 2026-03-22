import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { readStoredPreferenceDraft } from '../preferences/storage';
import type { RoutePreference } from '../preferences/types';
import {
  OnboardingPreferencesLayout,
  ROUTE_PREFERENCE_OPTIONS,
  preferenceStyles,
} from './OnboardingPreferenceShared';

type OnboardingRoutePreferenceScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'OnboardingRoutePreference'
>;

export default function OnboardingRoutePreferenceScreen({
  navigation,
}: OnboardingRoutePreferenceScreenProps) {
  const [selectedPreference, setSelectedPreference] = useState<RoutePreference>('balanced');
  const proceedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const storedDraft = await readStoredPreferenceDraft();

      if (!isMounted || !storedDraft) {
        return;
      }

      setSelectedPreference(storedDraft.defaultPreference);
    })();

    return () => {
      isMounted = false;
      if (proceedTimerRef.current) clearTimeout(proceedTimerRef.current);
    };
  }, []);

  const handleSelect = (value: RoutePreference) => {
    setSelectedPreference(value);
    proceedTimerRef.current = setTimeout(() => {
      navigation.navigate('OnboardingPassengerProfile', {
        defaultPreference: value,
      });
    }, 180);
  };

  return (
    <OnboardingPreferencesLayout
      title="Choose your route default"
      subtitle="Pick how Sakai should sort route options."
      activeStep={0}
      onBack={() => navigation.goBack()}
    >
      <View>
        {ROUTE_PREFERENCE_OPTIONS.map((option) => {
          const isSelected = option.value === selectedPreference;

          return (
            <TouchableOpacity
              key={option.value}
              style={[preferenceStyles.optionCard, isSelected && preferenceStyles.optionCardSelected]}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.88}
            >
              <View style={preferenceStyles.optionHeader}>
                <Text
                  style={[
                    preferenceStyles.optionTitle,
                    isSelected && preferenceStyles.optionTitleSelected,
                  ]}
                >
                  {option.title}
                </Text>
                <View style={[preferenceStyles.radio, isSelected && preferenceStyles.radioSelected]}>
                  {isSelected ? <View style={preferenceStyles.radioDot} /> : null}
                </View>
              </View>
              <Text
                style={[
                  preferenceStyles.optionDescription,
                  isSelected && preferenceStyles.optionDescriptionSelected,
                ]}
              >
                {option.description}
              </Text>
            </TouchableOpacity>
          );
        })}

      </View>
    </OnboardingPreferencesLayout>
  );
}
