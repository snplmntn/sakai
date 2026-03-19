import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';

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

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  return (
    <SafeScreen backgroundColor={COLORS.surface} useGradient={true}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerGlow} />
          <Text style={styles.title}>Profile</Text>

          <View style={styles.card}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>S</Text>
              </View>
            </View>
            <View style={styles.identityBlock}>
              <Text style={styles.name}>Sakai Commuter</Text>
              <Text style={styles.email}>commuter@sakai.app</Text>
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>Community rider</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          {PROFILE_STATS.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Text style={styles.sectionSubtitle}>
            These settings shape how Sakai surfaces route suggestions for you.
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

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.logoutHint}>
          Logging out returns you to onboarding without deleting your saved commute preferences.
        </Text>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl + 32,
  },
  headerCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#102033',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  headerGlow: {
    position: 'absolute',
    top: -56,
    right: -16,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.title,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    marginBottom: SPACING.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  avatarRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: TYPOGRAPHY.fontSizes.title,
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
    backgroundColor: COLORS.white,
  },
  memberBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4ECF2',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.subText,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E4ECF2',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  preferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
    marginBottom: -SPACING.xs,
  },
  preferenceChip: {
    backgroundColor: '#EEF5FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 999,
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  preferenceText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  detailRow: {
    paddingVertical: SPACING.sm,
  },
  detailDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  detailTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  detailDescription: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 22,
  },
  logoutButton: {
    backgroundColor: '#101828',
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
  },
  logoutHint: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
});
