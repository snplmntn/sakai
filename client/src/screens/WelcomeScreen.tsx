import { useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowRight01Icon,
  Mic01Icon,
  RouteIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { COLORS, FONTS, SPACING, TYPOGRAPHY } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';

const ONBOARDING_STEPS = [
  {
    id: '1',
    icon: Mic01Icon,
    title: 'Ask by voice',
    subtitle: 'Tell Sakai where you are going and get practical commute guidance fast.',
    badge: 'Voice',
  },
  {
    id: '2',
    icon: RouteIcon,
    title: 'See route options',
    subtitle: 'Compare fares, transfers, and jeepney-first combinations before you ride.',
    badge: 'Routes',
  },
  {
    id: '3',
    icon: UserGroupIcon,
    title: 'Ride with confidence',
    subtitle: 'Stay clear on local updates and improve missing route details with the community.',
    badge: 'Local',
  },
] as const;

type WelcomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingStep>>(null);
  const { width, height } = useWindowDimensions();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(nextIndex);
  };

  const handleGetStarted = () => {
    navigation.navigate('OnboardingRoutePreference');
  };

  const handleNext = () => {
    if (currentIndex === ONBOARDING_STEPS.length - 1) {
      handleGetStarted();
      return;
    }

    flatListRef.current?.scrollToIndex({
      index: currentIndex + 1,
      animated: true,
    });
  };

  const handleBack = () => {
    if (currentIndex === 0) {
      return;
    }

    flatListRef.current?.scrollToIndex({
      index: currentIndex - 1,
      animated: true,
    });
  };

  const renderPlaceholder = (item: OnboardingStep) => (
    <View style={styles.artworkArea}>
      <View style={styles.artworkBackShadow} />
      <View style={[styles.artworkLeaf, styles.artworkLeafLeft]} />
      <View style={[styles.artworkLeaf, styles.artworkLeafRight]} />
      <View style={styles.artworkGround} />

      <LinearGradient colors={['#A8CBFF', COLORS.primary]} style={styles.placeholderCard}>
        <View style={styles.placeholderTopRow}>
          <View style={styles.placeholderLineShort} />
          <View style={styles.placeholderLineTiny} />
        </View>

        <View style={styles.placeholderCenter}>
          <View style={styles.placeholderIconWrap}>
            <HugeiconsIcon icon={item.icon} size={48} color={COLORS.white} />
          </View>
          <Text style={styles.placeholderLabel}>Image Placeholder</Text>
        </View>
      </LinearGradient>

      <View style={styles.floatingBadge}>
        <Text style={styles.floatingBadgeText}>{item.badge}</Text>
      </View>
    </View>
  );

  const renderStep = ({ item, index }: { item: OnboardingStep; index: number }) => {
    const isLastStep = index === ONBOARDING_STEPS.length - 1;

    return (
      <View style={[styles.slide, { width }]}>
        <View style={[styles.fullScreenPanel, { minHeight: height - 120 }]}>
          <View style={styles.topActionRow}>
            <View style={styles.topActionSpacer} />
            {!isLastStep ? (
              <TouchableOpacity onPress={handleGetStarted} activeOpacity={0.8}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.topActionSpacer} />
            )}
          </View>

          <View style={styles.topSection}>
            {renderPlaceholder(item)}

            <View style={styles.copyBlock}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>

          <View style={styles.bottomSection}>
            {isLastStep ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGetStarted}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={COLORS.white} />
              </TouchableOpacity>
            ) : (
              <View style={styles.inlineControls}>
                <TouchableOpacity
                  onPress={handleBack}
                  activeOpacity={0.8}
                  disabled={currentIndex === 0}
                >
                  <Text
                    style={[
                      styles.backText,
                      currentIndex === 0 && styles.backTextHidden,
                    ]}
                  >
                    Back
                  </Text>
                </TouchableOpacity>

                <View style={styles.dotsRow}>
                  {ONBOARDING_STEPS.map((_, dotIndex) => (
                    <View
                      key={dotIndex}
                      style={[
                        styles.dot,
                        dotIndex === currentIndex && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNext}
                  activeOpacity={0.88}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeScreen
      backgroundColor={COLORS.gradientStart}
      topInsetBackgroundColor={COLORS.gradientStart}
      useGradient={true}
    >
      <View style={styles.screen}>
        <LinearGradient
          colors={['rgba(0,122,255,0.14)', 'rgba(0,122,255,0.06)', 'rgba(0,122,255,0.01)']}
          start={{ x: 0.18, y: 0.12 }}
          end={{ x: 0.88, y: 0.9 }}
          style={styles.backgroundOrbTop}
        />
        <LinearGradient
          colors={['rgba(156,197,232,0.18)', 'rgba(156,197,232,0.07)', 'rgba(156,197,232,0.01)']}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.92 }}
          style={styles.backgroundOrbBottom}
        />

        <FlatList
          ref={flatListRef}
          data={ONBOARDING_STEPS}
          renderItem={renderStep}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
        />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: 72,
    right: -52,
    width: 196,
    height: 196,
    borderRadius: 999,
    opacity: 0.95,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 10 },
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 94,
    left: -40,
    width: 168,
    height: 168,
    borderRadius: 999,
    opacity: 0.92,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.05,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 10 },
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  fullScreenPanel: {
    width: '100%',
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    justifyContent: 'space-between',
  },
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 28,
    marginBottom: SPACING.md,
  },
  topActionSpacer: {
    width: 52,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
  },
  artworkArea: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  artworkBackShadow: {
    position: 'absolute',
    top: 18,
    width: 232,
    height: 158,
    borderRadius: 32,
    backgroundColor: 'rgba(221,235,244,0.88)',
  },
  artworkLeaf: {
    position: 'absolute',
    backgroundColor: 'rgba(0,122,255,0.1)',
    opacity: 0.9,
  },
  artworkLeafLeft: {
    left: 26,
    bottom: 44,
    width: 58,
    height: 96,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 52,
    transform: [{ rotate: '-30deg' }],
  },
  artworkLeafRight: {
    right: 30,
    bottom: 58,
    width: 86,
    height: 44,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 40,
    transform: [{ rotate: '22deg' }],
  },
  artworkGround: {
    position: 'absolute',
    bottom: 34,
    width: 180,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(16,32,51,0.08)',
  },
  placeholderCard: {
    width: 196,
    height: 132,
    borderRadius: 26,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    justifyContent: 'space-between',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  placeholderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeholderLineShort: {
    width: 56,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  placeholderLineTiny: {
    width: 22,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  placeholderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(16,32,51,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  placeholderLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  floatingBadge: {
    position: 'absolute',
    top: 54,
    left: 30,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    shadowColor: COLORS.midnight,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(16,32,51,0.06)',
  },
  floatingBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
  },
  copyBlock: {
    paddingHorizontal: 0,
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontFamily: FONTS.bold,
    color: COLORS.midnight,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    textAlign: 'center',
  },
  bottomSection: {
    paddingTop: SPACING.lg,
  },
  inlineControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.subText,
    textTransform: 'uppercase',
  },
  backTextHidden: {
    opacity: 0,
  },
  skipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.subText,
    textTransform: 'uppercase',
    transform: [{ translateY: -4 }],
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(16,32,51,0.24)',
    marginHorizontal: 7,
  },
  dotActive: {
    width: 9,
    height: 28,
    backgroundColor: COLORS.black,
  },
  nextButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.midnight,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.black,
    borderRadius: 18,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
