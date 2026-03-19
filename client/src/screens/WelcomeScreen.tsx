import { useRef, useState } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Mic01Icon, RouteIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';
import { usePreferences } from '../preferences/PreferencesContext';
import {
  PASSENGER_TYPE_OPTIONS,
  ROUTE_PREFERENCE_OPTIONS,
} from '../preferences/types';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = SPACING.lg;
const CARD_WIDTH = width - CARD_HORIZONTAL_PADDING * 2;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

const ONBOARDING_STEPS = [
  {
    id: '1',
    icon: Mic01Icon,
    title: 'Just Say It',
    subtitle: 'Ask for directions the way you naturally would — by voice or text.',
  },
  {
    id: '2',
    icon: RouteIcon,
    title: 'Jeepney-First Routes',
    subtitle: 'Get route suggestions that actually include jeepney legs, stops, and transfers.',
  },
  {
    id: '3',
    icon: UserGroupIcon,
    title: 'Community-Powered',
    subtitle: 'Help build better routes. Report missing stops or share local knowledge.',
  },
];

export default function WelcomeScreen({ navigation }: { navigation: NavigationProp }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { preferences, status, updatePreferences } = usePreferences();

  const isLastStep = currentIndex === ONBOARDING_STEPS.length - 1;
  const isPreferencesReady = status === 'ready';

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleGetStarted = () => {
    navigation.navigate('Login');
  };

  const handleNext = () => {
    if (isLastStep) {
      handleGetStarted();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const renderStep = ({ item }: { item: typeof ONBOARDING_STEPS[0] }) => (
    <View style={styles.slideWrapper}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <HugeiconsIcon icon={item.icon} size={88} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeScreen backgroundColor={COLORS.white} useGradient={true}>
      <View style={styles.header} />

      <FlatList
        ref={flatListRef}
        data={ONBOARDING_STEPS}
        renderItem={renderStep}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        bounces={false}
        style={styles.flatList}
      />

      <View style={styles.footer}>
        <View style={styles.preferenceCard}>
          <Text style={styles.preferenceTitle}>Set your default commute style</Text>
          <Text style={styles.preferenceSubtitle}>
            Sakai uses these choices to rank routes and price eligible jeepney fares.
          </Text>

          <View style={styles.preferenceGroup}>
            <Text style={styles.preferenceGroupLabel}>Route preference</Text>
            <View style={styles.chipRow}>
              {ROUTE_PREFERENCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.selectionChip,
                    preferences.defaultPreference === option.value &&
                      styles.selectionChipActive,
                  ]}
                  activeOpacity={0.85}
                  disabled={!isPreferencesReady}
                  onPress={() => {
                    void updatePreferences({
                      defaultPreference: option.value,
                      passengerType: preferences.passengerType,
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.selectionChipText,
                      preferences.defaultPreference === option.value &&
                        styles.selectionChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.preferenceGroup}>
            <Text style={styles.preferenceGroupLabel}>Passenger type</Text>
            <View style={styles.chipRow}>
              {PASSENGER_TYPE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.selectionChip,
                    preferences.passengerType === option.value &&
                      styles.selectionChipActive,
                  ]}
                  activeOpacity={0.85}
                  disabled={!isPreferencesReady}
                  onPress={() => {
                    void updatePreferences({
                      defaultPreference: preferences.defaultPreference,
                      passengerType: option.value,
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.selectionChipText,
                      preferences.passengerType === option.value &&
                        styles.selectionChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.preferenceHint}>
            You can change these later in Profile after signing in.
          </Text>
        </View>

        <View style={styles.dotsContainer}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.buttonText}>
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.signInLink}>
          <Text style={styles.signInText}>
            Existing user? <Text style={styles.signInHighlight}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  skipText: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
  },
  flatList: {
    flex: 1,
  },
  slideWrapper: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
  },
  card: {
    width: CARD_WIDTH,
    paddingVertical: SPACING.xxl + 16,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.title,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.sm,
  },
  footer: {
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  preferenceCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2EAF0',
    marginBottom: SPACING.lg,
  },
  preferenceTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  preferenceSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  preferenceGroup: {
    marginBottom: SPACING.md,
  },
  preferenceGroupLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.subText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  selectionChip: {
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: '#F4F8FB',
    borderWidth: 1,
    borderColor: '#DCE7EF',
  },
  selectionChipActive: {
    backgroundColor: '#102033',
    borderColor: '#102033',
  },
  selectionChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#415466',
  },
  selectionChipTextActive: {
    color: COLORS.white,
  },
  preferenceHint: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: COLORS.black,
  },
  button: {
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.xxl * 2,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
  },
  signInLink: {
    marginTop: SPACING.xs,
  },
  signInText: {
    color: COLORS.subText,
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.medium,
  },
  signInHighlight: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
});
