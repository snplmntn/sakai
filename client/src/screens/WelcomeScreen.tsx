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
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';

const { width, height } = Dimensions.get('window');

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

  const isLastStep = currentIndex === ONBOARDING_STEPS.length - 1;

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
    <View style={styles.slide}>
      <View style={styles.iconCircle}>
        <HugeiconsIcon icon={item.icon} size={48} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <SafeScreen>
      {/* Skip */}
      <TouchableOpacity style={styles.skipButton} onPress={handleGetStarted}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Carousel */}
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

      {/* Dots + Button */}
      <View style={styles.footer}>
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

        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  skipText: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontWeight: TYPOGRAPHY.fontWeights.medium,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EBF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.title,
    fontWeight: TYPOGRAPHY.fontWeights.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    color: COLORS.subText,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.md,
  },
  footer: {
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontWeight: TYPOGRAPHY.fontWeights.bold,
  },
});
