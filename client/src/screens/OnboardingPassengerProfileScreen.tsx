import { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { writeStoredPreferenceDraft } from '../preferences/storage';
import type { PassengerType } from '../preferences/types';
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

  const { defaultPreference } = route.params;

  const handleContinue = async (destination: 'Signup' | 'Login') => {
    if (isContinuing) {
      return;
    }

    setIsContinuing(true);

    try {
      await writeStoredPreferenceDraft({
        defaultPreference,
        passengerType,
        routeModifiers: [],
      });

      navigation.navigate(destination);
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <OnboardingPreferencesLayout
      title="Choose your passenger profile"
      subtitle="Pick the fare profile Sakai should use."
      activeStep={1}
      onBack={() => navigation.goBack()}
      footer={
        <>
          <TouchableOpacity
            style={[preferenceStyles.primaryButton, isContinuing && preferenceStyles.buttonDisabled]}
            onPress={() => {
              void handleContinue('Signup');
            }}
            activeOpacity={0.88}
            disabled={isContinuing}
          >
            {isContinuing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={preferenceStyles.primaryButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </>
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
                onPress={() => setPassengerType(option.value)}
                activeOpacity={0.88}
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
