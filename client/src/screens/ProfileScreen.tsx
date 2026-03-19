import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import { useToast } from '../toast/ToastContext';

const PROFILE_STATS = [
  { value: '08', label: 'Saved routes' },
  { value: '21', label: 'Trips this month' },
  { value: '06', label: 'Reports shared' },
];

const PREFERENCES = ['Jeepney first', 'Less walking', 'Cash fare view'];

const ACCOUNT_SECTIONS = [
  {
    title: 'Commute style',
    description: 'Prioritizes local transit routes with clearer transfer timing.',
  },
  {
    title: 'Saved places',
    description: 'Home, Work, and 3 recent destinations are ready for quick planning.',
  },
  {
    title: 'Community activity',
    description: 'You helped verify 2 stop names and 1 transfer point this week.',
  },
];

type ProfileScreenProps = BottomTabScreenProps<MainTabParamList, 'Profile'>;

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

  if (fullName) {
    return fullName;
  }

  const firstName = getMetadataString(metadata, 'first_name');
  const lastName = getMetadataString(metadata, 'last_name');

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  if (firstName) {
    return firstName;
  }

  if (email) {
    return email.split('@')[0];
  }

  return 'Sakai commuter';
};

const getInitial = (label: string): string => label.trim().charAt(0).toUpperCase() || 'S';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Unable to refresh your profile right now.';

export default function ProfileScreen(_props: ProfileScreenProps) {
  const { user, refreshUser, signOut } = useAuth();
  const { showToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncProfile = async () => {
      try {
        await refreshUser();
      } catch (error) {
        if (isMounted) {
          showToast({
            tone: 'error',
            message: getErrorMessage(error),
          });
        }
      } finally {
        if (isMounted) {
          setIsRefreshing(false);
        }
      }
    };

    void syncProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut();
      showToast({
        tone: 'success',
        message: 'You have been logged out.',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        message: getErrorMessage(error),
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = getDisplayName(user?.email ?? null, user?.userMetadata ?? null);
  const emailAddress = user?.email ?? 'No email available';

  return (
    <SafeScreen
      backgroundColor={COLORS.surface}
      topInsetBackgroundColor="#102033"
      statusBarStyle="light"
      useGradient={true}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerRule} />
          <Text style={styles.headerLabel}>Profile</Text>

          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitial(displayName)}</Text>
            </View>
            <View style={styles.identityBlock}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{emailAddress}</Text>
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>Authenticated rider</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {isRefreshing ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.statusText}>Syncing your profile</Text>
            </View>
          ) : null}

          <View style={styles.statsCard}>
            {PROFILE_STATS.map((item, index) => (
              <View
                key={item.label}
                style={[styles.statItem, index !== PROFILE_STATS.length - 1 && styles.statDivider]}
              >
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <Text style={styles.sectionSubtitle}>
              These settings shape how Sakai ranks route suggestions for you.
            </Text>
            <View style={styles.preferenceRow}>
              {PREFERENCES.map((item) => (
                <View key={item} style={styles.preferenceChip}>
                  <Text style={styles.preferenceText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account overview</Text>
            <View style={styles.detailList}>
              {ACCOUNT_SECTIONS.map((section, index) => (
                <View
                  key={section.title}
                  style={[styles.detailRow, index !== ACCOUNT_SECTIONS.length - 1 && styles.detailDivider]}
                >
                  <Text style={styles.detailTitle}>{section.title}</Text>
                  <Text style={styles.detailDescription}>{section.description}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.logoutButton, isSigningOut && styles.logoutButtonDisabled]}
            onPress={() => {
              void handleLogout();
            }}
            activeOpacity={0.88}
            disabled={isSigningOut}
          >
            {isSigningOut ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.logoutText}>Log Out</Text>}
          </TouchableOpacity>

          <Text style={styles.logoutHint}>
            Logging out returns you to onboarding without deleting your saved commute preferences.
          </Text>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SPACING.xl + 24,
  },
  body: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.lg,
  },
  headerCard: {
    backgroundColor: '#102033',
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  headerRule: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.md,
  },
  headerLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.68)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  identityBlock: {
    flex: 1,
  },
  name: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  email: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: SPACING.sm,
  },
  memberBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  memberBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E2EAF0',
  },
  statItem: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  statDivider: {
    borderRightWidth: 1,
    borderRightColor: '#E4ECF2',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2EAF0',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#102033',
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  preferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  preferenceChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 999,
    backgroundColor: '#F4F8FB',
    borderWidth: 1,
    borderColor: '#E2EAF0',
  },
  preferenceText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#415466',
  },
  detailList: {
    marginTop: SPACING.sm,
  },
  detailRow: {
    paddingVertical: SPACING.md,
  },
  detailDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  detailTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: '#102033',
    marginBottom: SPACING.xs,
  },
  detailDescription: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 22,
  },
  logoutButton: {
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
  },
  logoutHint: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 20,
    textAlign: 'center',
  },
});
