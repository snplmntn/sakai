import { StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

interface MapSetupNoticeProps {
  compact?: boolean;
}

export default function MapSetupNotice({
  compact = false,
}: MapSetupNoticeProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={styles.title}>Google Maps is not configured</Text>
      <Text style={styles.body}>
        Add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `client/.env`, then rebuild the native app to
        load map tiles.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 220,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DCE7EF',
    backgroundColor: '#F7FAFC',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  containerCompact: {
    minHeight: 180,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
    color: '#102033',
  },
  body: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
    lineHeight: 20,
  },
});
