import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Manage your details here.</Text>

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
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
    borderRadius: SPACING.sm,
    alignItems: 'center',
    width: '50%'
  },
  logoutButton: {
    backgroundColor: COLORS.danger,
  },
  buttonText: { 
    color: COLORS.white, 
    fontSize: TYPOGRAPHY.fontSizes.medium, 
    fontWeight: TYPOGRAPHY.fontWeights.semibold 
  }
});
