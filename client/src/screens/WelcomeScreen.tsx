import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';

import SafeScreen from '../components/SafeScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: { navigation: NavigationProp }) {
  return (
    <SafeScreen style={styles.container}>
      <Text style={styles.title}>Welcome to SakayApp</Text>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Login')}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.white 
  },
  title: { 
    fontSize: TYPOGRAPHY.fontSizes.xlarge, 
    fontWeight: TYPOGRAPHY.fontWeights.bold, 
    marginBottom: SPACING.lg,
    color: COLORS.text,
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
