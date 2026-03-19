import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: { navigation: NavigationProp }) {
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>You have successfully logged in!</Text>
      
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
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
    backgroundColor: COLORS.danger, 
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
