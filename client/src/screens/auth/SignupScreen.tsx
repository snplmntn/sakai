import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/theme';

import SafeScreen from '../../components/SafeScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: { navigation: NavigationProp }) {
  const handleSubmit = () => {
    // Mock authentication logic
    navigation.replace('MainTabs');
  };

  return (
    <SafeScreen style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={COLORS.subText}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        placeholderTextColor={COLORS.subText}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        placeholderTextColor={COLORS.subText}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.toggleButton}>
        <Text style={styles.toggleText}>
          Already have an account? Login
        </Text>
      </TouchableOpacity>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
    backgroundColor: COLORS.white
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.title,
    fontWeight: TYPOGRAPHY.fontWeights.bold,
    marginBottom: SPACING.xl,
    textAlign: 'center',
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SPACING.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: SPACING.sm,
    alignItems: 'center'
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontWeight: TYPOGRAPHY.fontWeights.bold
  },
  toggleButton: {
    marginTop: SPACING.lg,
    alignItems: 'center'
  },
  toggleText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.medium
  }
});
