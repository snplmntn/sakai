import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import SafeScreen from '../components/SafeScreen';

const SEARCH_EXAMPLES = ['Cubao', 'MOA', 'PUP Sta. Mesa'];

const PREFERENCES = [
  { label: 'Balanced', active: true },
  { label: 'Cheapest', active: false },
  { label: 'Fastest', active: false },
];

const ROUTE_OPTIONS = [
  {
    title: 'Best for your preference',
    destination: 'España to BGC',
    summary: 'Jeep to MRT, then a short BGC Bus transfer with less walking near the end.',
    duration: '52 min',
    fare: 'PHP 34',
    fareStatus: 'Estimated',
    transfers: '2 transfers',
    modes: ['Jeepney', 'MRT', 'Bus'],
  },
  {
    title: 'Lower fare option',
    destination: 'España to BGC',
    summary: 'Longer jeepney segment with one transfer and a slightly longer final walk.',
    duration: '61 min',
    fare: 'PHP 24',
    fareStatus: 'Estimated',
    transfers: '1 transfer',
    modes: ['Jeepney', 'Jeepney', 'Walk'],
  },
];

const ALERTS = [
  {
    title: 'EDSA Guadalupe',
    detail: 'Northbound lane obstruction may slow BGC-bound transfers.',
  },
  {
    title: 'Ayala approach',
    detail: 'Moderate slowdown reported near the tunnel corridor.',
  },
];

export default function RoutesScreen() {
  return (
    <SafeScreen
      backgroundColor={COLORS.surface}
      topInsetBackgroundColor="#102033"
      statusBarStyle="light"
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroRule} />
          <Text style={styles.heroTitle}>
            Sak<Text style={{ color: '#FFB267' }}>ai</Text> tayo?
          </Text>
          <Text style={styles.heroSubtitle}>
            Your digital “barker” for the modern commute.
          </Text>

          <View style={styles.searchCard}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Destination</Text>
              <Text style={styles.searchMeta}>Google Maps lookup</Text>
            </View>
            <View style={styles.searchField}>
              <Text style={styles.searchFieldLabel}>From</Text>
              <Text style={styles.searchFieldValue}>Bambang, Manila</Text>
            </View>
            <Text style={styles.searchHint}>Tap or speak to start.</Text>
            <View style={styles.exampleRow}>
              {SEARCH_EXAMPLES.map((destination) => (
                <View key={destination} style={styles.exampleChip}>
                  <Text style={styles.exampleText}>{destination}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Route preference</Text>
              <Text style={styles.sectionMeta}>Default ranking</Text>
            </View>
            <View style={styles.preferenceRow}>
              {PREFERENCES.map((preference) => (
                <View
                  key={preference.label}
                  style={[styles.preferenceChip, preference.active && styles.preferenceChipActive]}
                >
                  <Text
                    style={[
                      styles.preferenceText,
                      preference.active && styles.preferenceTextActive,
                    ]}
                  >
                    {preference.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Map and route canvas</Text>
              <Text style={styles.sectionMeta}>Google Maps</Text>
            </View>
            <Text style={styles.sectionDescription}>Google Maps drives the canvas.</Text>
            <View style={styles.mapSurface}>
              <View style={styles.mapLineRow}>
                <View style={[styles.mapNode, styles.mapNodeOrigin]} />
                <View style={styles.mapTrack} />
                <View style={styles.mapNodeTransfer} />
                <View style={styles.mapTrackMuted} />
                <View style={[styles.mapNode, styles.mapNodeDestination]} />
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
              <Text style={styles.sectionTitle}>Suggested routes</Text>
              <Text style={styles.sectionMeta}>Jeepney-first</Text>
            </View>

            {ROUTE_OPTIONS.map((route) => (
              <View key={route.title} style={styles.routeCard}>
                <View style={styles.routeTopRow}>
                  <Text style={styles.routeEyebrow}>{route.title}</Text>
                  <View style={styles.fareStatusBadge}>
                    <Text style={styles.fareStatusText}>{route.fareStatus}</Text>
                  </View>
                </View>

                <Text style={styles.routeTitle}>{route.destination}</Text>
                <Text style={styles.routeSummary}>{route.summary}</Text>

                <View style={styles.routeMetaRow}>
                  {route.modes.map((mode, index) => (
                    <Text key={`${route.destination}-${mode}-${index}`} style={styles.routeMetaText}>
                      {index === route.modes.length - 1 ? mode : `${mode} •`}
                    </Text>
                  ))}
                </View>

                <View style={styles.routeStatsRow}>
                  <View style={styles.routeStatBlock}>
                    <Text style={styles.routeStatLabel}>Time</Text>
                    <Text style={styles.routeStatValue}>{route.duration}</Text>
                  </View>
                  <View style={styles.routeStatDivider} />
                  <View style={styles.routeStatBlock}>
                    <Text style={styles.routeStatLabel}>Fare</Text>
                    <Text style={styles.routeStatValue}>{route.fare}</Text>
                  </View>
                  <View style={styles.routeStatDivider} />
                  <View style={styles.routeStatBlock}>
                    <Text style={styles.routeStatLabel}>Transfers</Text>
                    <Text style={styles.routeStatValue}>{route.transfers}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Area updates</Text>
              <Text style={styles.sectionMeta}>Route relevant</Text>
            </View>
            <Text style={styles.sectionDescription}>Only corridor-relevant alerts.</Text>
            <View style={styles.alertList}>
              {ALERTS.map((alert) => (
                <View key={alert.title} style={styles.alertRow}>
                  <View style={styles.alertMarker} />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertDetail}>{alert.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
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
  heroCard: {
    backgroundColor: '#102033',
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  heroRule: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.md,
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
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  searchCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  searchTitle: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  searchMeta: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.64)',
  },
  searchField: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    marginBottom: SPACING.sm,
  },
  searchFieldLabel: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.subText,
    marginBottom: SPACING.xs,
  },
  searchFieldValue: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  searchHint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  exampleChip: {
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  exampleText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
  section: {
    gap: SPACING.md,
  },
  panel: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2EAF0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  sectionMeta: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 18,
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
    backgroundColor: 'rgba(16,32,51,0.04)',
    borderWidth: 1,
    borderColor: '#DCE7EF',
  },
  preferenceChipActive: {
    backgroundColor: '#102033',
    borderColor: '#102033',
  },
  preferenceText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: '#415466',
  },
  preferenceTextActive: {
    color: COLORS.white,
  },
  mapSurface: {
    borderRadius: RADIUS.md,
    backgroundColor: '#F5F9FC',
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E4ECF2',
  },
  mapLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  mapNode: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  mapNodeOrigin: {
    backgroundColor: '#102033',
  },
  mapNodeTransfer: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7EAED8',
  },
  mapNodeDestination: {
    backgroundColor: COLORS.primary,
  },
  mapTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.sm,
  },
  mapTrackMuted: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#BFD8EB',
    marginHorizontal: SPACING.sm,
  },
  mapLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapLegendText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
  routeCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2EAF0',
    gap: SPACING.md,
  },
  routeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  routeEyebrow: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fareStatusBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: '#EEF5FF',
  },
  fareStatusText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  routeTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  routeSummary: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 18,
  },
  routeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  routeMetaText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#415466',
  },
  routeStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#F7FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E8EFF4',
  },
  routeStatBlock: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  routeStatDivider: {
    width: 1,
    backgroundColor: '#E4ECF2',
  },
  routeStatLabel: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#6B7D8E',
    marginBottom: SPACING.xs,
  },
  routeStatValue: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#102033',
  },
  alertList: {
    gap: SPACING.md,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  alertMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.warning,
    marginTop: 6,
  },
  alertContent: {
    flex: 1,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
    color: '#102033',
    marginBottom: SPACING.xs,
  },
  alertDetail: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 18,
  },
});
