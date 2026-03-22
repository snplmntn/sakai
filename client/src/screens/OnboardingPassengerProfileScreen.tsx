import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  readStoredPreferenceDraft,
  writeStoredPreferenceDraft,
} from '../preferences/storage';
import {
  createDefaultUserPreferences,
  type PassengerType,
} from '../preferences/types';
import {
  OnboardingPreferencesLayout,
  PASSENGER_TYPE_OPTIONS,
  preferenceStyles,
} from './OnboardingPreferenceShared';

type OnboardingPassengerProfileScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'OnboardingPassengerProfile'
>;

export default function OnboardingPassengerProfileScreen({
  navigation,
  route,
}: OnboardingPassengerProfileScreenProps) {
  const [passengerType, setPassengerType] = useState<PassengerType>('regular');
  const [isContinuing, setIsContinuing] = useState(false);
  const proceedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { defaultPreference } = route.params;

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const storedDraft = await readStoredPreferenceDraft();

      if (!isMounted || !storedDraft) {
        return;
      }

      setPassengerType(storedDraft.passengerType);
    })();

    return () => {
      isMounted = false;
      if (proceedTimerRef.current) clearTimeout(proceedTimerRef.current);
    };
  }, []);

  const handleSelect = (selected: PassengerType) => {
    if (isContinuing) return;
    setPassengerType(selected);

    proceedTimerRef.current = setTimeout(() => {
      setIsContinuing(true);
      void (async () => {
        try {
          const storedDraft = await readStoredPreferenceDraft();
          const localDefaults = createDefaultUserPreferences();

          await writeStoredPreferenceDraft({
            defaultPreference,
            passengerType: selected,
            routeModifiers: storedDraft?.routeModifiers ?? localDefaults.routeModifiers,
            voiceLanguage: storedDraft?.voiceLanguage ?? localDefaults.voiceLanguage,
            commuteModes: storedDraft?.commuteModes ?? localDefaults.commuteModes,
            allowCarAccess: storedDraft?.allowCarAccess ?? localDefaults.allowCarAccess,
          });

          navigation.navigate('Signup');
        } finally {
          setIsContinuing(false);
        }
      })();
    }, 180);
  };

  return (
    <OnboardingPreferencesLayout
      title="Choose your passenger profile"
      subtitle="Pick the fare profile Sakai should use."
      activeStep={1}
      onBack={() => navigation.goBack()}
      footer={
        isContinuing ? (
          <View style={preferenceStyles.primaryButton}>
            <ActivityIndicator color={COLORS.white} />
          </View>
        ) : null
      }
    >
      <View>
        <View style={preferenceStyles.passengerGrid}>
          {PASSENGER_TYPE_OPTIONS.map((option) => {
            const isSelected = option.value === passengerType;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  preferenceStyles.passengerCard,
                  isSelected && preferenceStyles.passengerCardSelected,
                ]}
                onPress={() => handleSelect(option.value)}
                activeOpacity={0.88}
                disabled={isContinuing}
              >
                <Text
                  style={[
                    preferenceStyles.passengerTitle,
                    isSelected && preferenceStyles.passengerTitleSelected,
                  ]}
                >
                  {option.title}
                </Text>
                <Text
                  style={[
                    preferenceStyles.passengerDescription,
                    isSelected && preferenceStyles.passengerDescriptionSelected,
                  ]}
                >
                  {option.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </OnboardingPreferencesLayout>
  );
}
