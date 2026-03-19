import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';

import SafeScreen from '../components/SafeScreen';

export default function RoutesScreen() {
  return (
    <SafeScreen style={styles.container} backgroundColor={COLORS.background}>
      <Text style={styles.title}>Routes</Text>
      <Text style={styles.subtitle}>View your routes here.</Text>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.background 
  },
  title: { 
    fontSize: TYPOGRAPHY.fontSizes.hero, 
    fontWeight: TYPOGRAPHY.fontWeights.bold, 
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  subtitle: { 
    fontSize: TYPOGRAPHY.fontSizes.large, 
    color: COLORS.subText, 
    marginBottom: SPACING.xxl 
  },
  button: { 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md, 
    borderRadius: SPACING.sm 
  },
  buttonText: { 
    color: COLORS.white, 
    fontSize: TYPOGRAPHY.fontSizes.medium, 
    fontWeight: TYPOGRAPHY.fontWeights.semibold 
  }
});
