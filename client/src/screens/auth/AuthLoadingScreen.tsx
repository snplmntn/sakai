import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import SafeScreen from '../../components/SafeScreen';
import { COLORS, FONTS, SPACING, TYPOGRAPHY } from '../../constants/theme';

export default function AuthLoadingScreen() {
  return (
    <SafeScreen backgroundColor={COLORS.surface} useGradient={true}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.title}>Checking your session</Text>
        <Text style={styles.subtitle}>Restoring your Sakai commute account.</Text>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  title: {
    marginTop: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
  },
});
