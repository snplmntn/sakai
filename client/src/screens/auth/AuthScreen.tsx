import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Auth'>;

export default function AuthScreen({ navigation }: { navigation: NavigationProp }) {
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = () => {
    // Mock authentication logic
    navigation.replace('Dashboard');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>

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
      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          placeholderTextColor={COLORS.subText}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleButton}>
        <Text style={styles.toggleText}>
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
        </Text>
      </TouchableOpacity>
    </View>
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
