import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import { useToast } from '../toast/ToastContext';

type ProfileRow = {
  title: string;
  description: string;
  badge?: string;
};

const PROFILE_ROWS: ProfileRow[] = [
  {
    title: 'Route preferences',
    description: 'Jeepney first, less walking, and cash fare view.',
  },
  {
    title: 'Passenger profile',
    description: 'Authenticated rider with saved commute defaults.',
  },
  {
    title: 'Saved places',
    description: 'Home, work, and recent destinations for faster planning.',
  },
  {
    title: 'Community activity',
    description: 'Reports and route improvements you shared with other riders.',
    badge: 'New',
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
      backgroundColor={COLORS.white}
      topInsetBackgroundColor={COLORS.white}
      statusBarStyle="dark"
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitial(displayName)}</Text>
            </View>
            <View style={styles.identityBlock}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{emailAddress}</Text>
            </View>
          </View>

          {isRefreshing ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.statusText}>Syncing your profile</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.list}>
              {PROFILE_ROWS.map((item, index) => (
                <View
                  key={item.title}
                  style={[styles.listRow, index !== PROFILE_ROWS.length - 1 && styles.listDivider]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowDescription}>{item.description}</Text>
                  </View>
                  <View style={styles.rowMeta}>
                    {item.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.chevron}>{'>'}</Text>
                  </View>
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
            {isSigningOut ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <Text style={styles.logoutText}>Log Out</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SPACING.xxl + 24,
  },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EFF4F8',
    borderWidth: 1,
    borderColor: '#E1E9F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md + 2,
  },
  avatarText: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.midnight,
  },
  identityBlock: {
    flex: 1,
  },
  name: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
    marginBottom: SPACING.xs,
  },
  email: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    marginBottom: SPACING.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.subText,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.semibold,
    color: COLORS.midnight,
    marginBottom: SPACING.md,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: '#EDF1F5',
  },
  listRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F5',
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  rowDescription: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 18,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#FDEAE4',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#D96B52',
  },
  chevron: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    color: '#9AA8B5',
  },
  logoutButton: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EBF0',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
  },
});
