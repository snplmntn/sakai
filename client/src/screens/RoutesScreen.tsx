import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';

const SEARCH_EXAMPLES = ['Cubao', 'MOA', 'PUP Sta. Mesa'];

const PREFERENCES = ['Balanced', 'Cheapest', 'Fastest'];

const ROUTE_OPTIONS = [
  {
    title: 'Best for your preference',
    destination: 'España to BGC',
    duration: '52 min',
    fare: 'PHP 34',
    transfers: '2 transfers',
    description: 'Jeep to MRT, then a short BGC Bus transfer with less walking near the end.',
    accent: '#DCEEFF',
    badge: 'Balanced',
    modes: ['Jeepney', 'MRT', 'Bus'],
  },
  {
    title: 'Lower fare option',
    destination: 'España to BGC',
    duration: '61 min',
    fare: 'PHP 24',
    transfers: '1 transfer',
    description: 'Longer jeepney segment with one transfer and a slightly longer final walk.',
    accent: '#DFF5EC',
    badge: 'Cheapest',
    modes: ['Jeepney', 'Jeepney', 'Walk'],
  },
];

const ALERTS = [
  'Northbound lane obstruction near EDSA Guadalupe may affect BGC-bound transfers.',
  'MMDA update: moderate slowdown near Ayala tunnel approach.',
];

export default function RoutesScreen() {
  return (
    <SafeScreen backgroundColor={COLORS.surface} useGradient={true}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroEyebrow}>Voice-first commute planning</Text>
          <Text style={styles.greeting}>Hello, Commuter</Text>
          <Text style={styles.heroTitle}>Where to Sakai today?</Text>
          <Text style={styles.heroSubtitle}>
            Search by voice or text, let Google Maps handle place lookup and map context, then compare
            Sakai’s jeepney-first route combinations.
          </Text>

          <View style={styles.searchPanel}>
            <View style={styles.searchMetaRow}>
              <Text style={styles.searchLabel}>Start with a destination</Text>
              <View style={styles.googleMapsPill}>
                <Text style={styles.googleMapsText}>Google Maps route</Text>
              </View>
            </View>
            <Text style={styles.searchPrompt}>
              Type a place, choose a suggestion, or speak naturally. Origin defaults to your current location.
            </Text>

            <View style={styles.searchInputShell}>
              <Text style={styles.searchInputLabel}>Current location</Text>
              <Text style={styles.searchInputValue}>Bambang, Manila</Text>
            </View>

            <View style={styles.destinationRow}>
              {SEARCH_EXAMPLES.map((destination) => (
                <View key={destination} style={styles.destinationChip}>
                  <Text style={styles.destinationText}>{destination}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route preference</Text>
          <Text style={styles.sectionDescription}>
            Rankings should reflect the onboarding choice and still let riders compare alternatives.
          </Text>
          <View style={styles.actionRow}>
            {PREFERENCES.map((action) => (
              <View key={action} style={styles.actionCard}>
                <Text style={styles.actionText}>{action}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.mapPreviewCard}>
          <View style={styles.mapPreviewHeader}>
            <Text style={styles.sectionTitle}>Map and route canvas</Text>
            <Text style={styles.sectionMeta}>Powered by Google Maps</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Place search and map rendering come from Google Maps. Sakai layers preference-aware route
            ranking, fare visibility, and jeepney-friendly explanations on top.
          </Text>
          <View style={styles.mapSurface}>
            <View style={styles.mapPinRow}>
              <View style={[styles.mapPin, styles.mapPinOrigin]} />
              <View style={styles.mapLine} />
              <View style={[styles.mapPin, styles.mapPinDestination]} />
            </View>
            <View style={styles.mapLegendRow}>
              <Text style={styles.mapLegendText}>Origin</Text>
              <Text style={styles.mapLegendText}>Transfer</Text>
              <Text style={styles.mapLegendText}>Destination</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggested route combinations</Text>
            <Text style={styles.sectionMeta}>Jeepney-first ranking</Text>
          </View>

          {ROUTE_OPTIONS.map((route) => (
            <View key={route.title} style={styles.routeCard}>
              <View style={[styles.routeAccent, { backgroundColor: route.accent }]} />
              <Text style={styles.routeCardEyebrow}>{route.title}</Text>
              <View style={styles.routeHeader}>
                <Text style={styles.routeTitle}>{route.destination}</Text>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>{route.badge}</Text>
                </View>
              </View>
              <Text style={styles.routeDescription}>{route.description}</Text>
              <View style={styles.modeRow}>
                {route.modes.map((mode, index) => (
                  <View key={`${route.title}-${mode}-${index}`} style={styles.modeChip}>
                    <Text style={styles.modeChipText}>{mode}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.routeStats}>
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>Trip time</Text>
                  <Text style={styles.statValue}>{route.duration}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>Estimated fare</Text>
                  <Text style={styles.statValue}>{route.fare}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statLabel}>Transfers</Text>
                  <Text style={styles.statValue}>{route.transfers}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Trip-aware area updates</Text>
          <Text style={styles.insightSubtitle}>
            MMDA updates should only appear when they matter to the route being compared or navigated.
          </Text>

          <View style={styles.alertList}>
            {ALERTS.map((item) => (
              <View key={item} style={styles.alertItem}>
                <View style={styles.alertDot} />
                <Text style={styles.alertText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl + 24,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#102033',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  heroGlow: {
    position: 'absolute',
    top: -44,
    right: -12,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroEyebrow: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
  },
  greeting: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.fontSizes.hero,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    lineHeight: 38,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  searchPanel: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  searchLabel: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  searchMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  googleMapsPill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  googleMapsText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  searchPrompt: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  searchInputShell: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    marginBottom: SPACING.md,
  },
  searchInputLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.subText,
    marginBottom: SPACING.xs,
  },
  searchInputValue: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  destinationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
    marginBottom: -SPACING.xs,
  },
  destinationChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  destinationText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  sectionDescription: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 22,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  sectionMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.subText,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
    marginBottom: -SPACING.xs,
  },
  actionCard: {
    minWidth: '30%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.sm + 4,
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  actionText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    lineHeight: 18,
  },
  mapPreviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E4ECF2',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  mapPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  mapSurface: {
    height: 180,
    borderRadius: RADIUS.md,
    backgroundColor: '#EAF3F8',
    padding: SPACING.md,
    justifyContent: 'center',
  },
  mapPinRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  mapPinOrigin: {
    backgroundColor: '#0F172A',
  },
  mapPinDestination: {
    backgroundColor: COLORS.primary,
  },
  mapLine: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#8BC4F6',
    marginHorizontal: SPACING.sm,
  },
  mapLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  mapLegendText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.subText,
  },
  routeCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: '#E4ECF2',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  routeCardEyebrow: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.subText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  routeAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 6,
    height: '100%',
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  routeTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  routeBadge: {
    backgroundColor: '#EEF5FF',
    borderRadius: 999,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
  },
  routeBadgeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  routeDescription: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
    marginBottom: SPACING.sm,
  },
  modeChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  modeChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#334155',
  },
  routeStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 4,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.subText,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  insightCard: {
    backgroundColor: '#EFF4F7',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  insightTitle: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  insightSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  alertList: {
    gap: SPACING.sm,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 4,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.warning,
    marginTop: 6,
    marginRight: SPACING.sm,
  },
  alertText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 22,
  },
});
