import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  SettingsIcon,
  AlarmClockIcon,
  FavouriteIcon,
  ArrowRightIcon,
  LogoutIcon,
} from '@hugeicons/core-free-icons';
import { useAuth } from '../auth/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useToast } from '../toast/ToastContext';

type ProfileRow = {
  route?: 'Preferences' | 'NavigationAlarm' | 'SavedPlaces';
  title: string;
  description: string;
  icon: object;
  iconBg: string;
  iconColor: string;
};

const PROFILE_ROWS: ProfileRow[] = [
  {
    title: 'Preferences',
    description: 'Fare, passenger type, and route defaults',
    route: 'Preferences',
    icon: SettingsIcon,
    iconBg: '#EEF5FF',
    iconColor: '#457B9D',
  },
  {
    title: 'Navigation alarm',
    description: 'Near-destination alert and live navigation',
    route: 'NavigationAlarm',
    icon: AlarmClockIcon,
    iconBg: '#FFF4EC',
    iconColor: '#D4824A',
  },
  {
    title: 'Saved places',
    description: 'Home, office, and frequent addresses',
    route: 'SavedPlaces',
    icon: FavouriteIcon,
    iconBg: '#F0FBF4',
    iconColor: '#3A9E6A',
  },
];

const getMetadataString = (
  metadata: Record<string, unknown> | null,
  fieldName: string
): string | null => {
  const value = metadata?.[fieldName];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const getDisplayName = (
  email: string | null,
  metadata: Record<string, unknown> | null
): string => {
  const fullName = getMetadataString(metadata, 'full_name') ?? getMetadataString(metadata, 'name');
  if (fullName) return fullName;

  const firstName = getMetadataString(metadata, 'first_name');
  const lastName = getMetadataString(metadata, 'last_name');
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (email) return email.split('@')[0];

  return 'Sakai commuter';
};

const getInitials = (label: string): string => {
  const parts = label.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return label.trim().charAt(0).toUpperCase() || 'S';
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Unable to refresh your profile right now.';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status, user, refreshUser, signOut } = useAuth();
  const { showToast } = useToast();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleRefreshError = useCallback(
    (error: unknown) => {
      showToast({ tone: 'error', message: getErrorMessage(error) });
    },
    [showToast]
  );

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        await refreshUser();
      } catch (error) {
        if (isMounted) handleRefreshError(error);
      } finally {
        if (isMounted) setIsInitialLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [handleRefreshError, refreshUser]);

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refreshUser();
    } catch (error) {
      handleRefreshError(error);
    } finally {
      setIsPullRefreshing(false);
    }
  }, [handleRefreshError, refreshUser]);

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      showToast({ tone: 'success', message: 'You have been logged out.' });
    } catch (error) {
      showToast({ tone: 'error', message: getErrorMessage(error) });
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = getDisplayName(user?.email ?? null, user?.userMetadata ?? null);
  const emailAddress = user?.email ?? 'No email available';
  const initials = getInitials(displayName);

  return (
    <SafeScreen
      backgroundColor="#F5F7FA"
      topInsetBackgroundColor="#102033"
      statusBarStyle="light"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={() => void handlePullRefresh()}
            tintColor={COLORS.white}
          />
        }
      >
        {/* ── Identity card ── */}
        <LinearGradient
          colors={['#102033', '#1a3a55', '#0d2a42']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Decorative circles */}
          <View style={styles.decCircle1} />
          <View style={styles.decCircle2} />

          {/* Avatar */}
          <View style={styles.avatarRing}>
            <LinearGradient
              colors={['#2a6496', '#457b9d']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
          </View>

          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroEmail}>{emailAddress}</Text>

          {/* Sakai badge */}
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>Sakai commuter</Text>
          </View>

          {isInitialLoading && (
            <View style={styles.syncRow}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
              <Text style={styles.syncText}>Syncing profile…</Text>
            </View>
          )}
        </LinearGradient>

        {/* ── Settings ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            {PROFILE_ROWS.map((item, index) => (
              <TouchableOpacity
                key={item.title}
                style={[
                  styles.row,
                  index < PROFILE_ROWS.length - 1 && styles.rowBorder,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.route === 'SavedPlaces' && status !== 'authenticated') {
                    navigation.navigate('Login', {
                      successMessage: 'Sign in to manage your saved places.',
                    });
                    return;
                  }
                  if (item.route) navigation.navigate(item.route);
                }}
              >
                <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                  <HugeiconsIcon icon={item.icon} size={20} color={item.iconColor} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowDesc}>{item.description}</Text>
                </View>
                <HugeiconsIcon icon={ArrowRightIcon} size={18} color="#BCC8D4" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Sign out ── */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => void handleLogout()}
              disabled={isSigningOut}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FEF0F0' }]}>
                {isSigningOut ? (
                  <ActivityIndicator size="small" color="#D95353" />
                ) : (
                  <HugeiconsIcon icon={LogoutIcon} size={20} color="#D95353" />
                )}
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, styles.rowTitleDanger]}>
                  {isSigningOut ? 'Signing out…' : 'Sign out'}
                </Text>
                <Text style={styles.rowDesc}>Log out of your Sakai account</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.versionText}>Sakai · Beta</Text>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: SPACING.xxl + 32,
  },

  // Hero
  heroCard: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl + 4,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  decCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.035)',
    top: -60,
    right: -50,
  },
  decCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.025)',
    bottom: -30,
    left: -20,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 3,
    marginBottom: SPACING.md,
  },
  avatar: {
    flex: 1,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroEmail: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5CC87A',
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  syncText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.4)',
  },

  // Section
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: '#8FA3B4',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
    marginLeft: 2,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E8EFF5',
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
    minHeight: 68,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F9',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: '#1A2E3F',
    marginBottom: 2,
  },
  rowTitleDanger: {
    color: '#D95353',
  },
  rowDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#8FA3B4',
    lineHeight: 17,
  },

  // Footer
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#B8C8D4',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
});
