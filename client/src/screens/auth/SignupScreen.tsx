import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../auth/api';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import SafeScreen from '../../components/SafeScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: { navigation: NavigationProp }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (email.trim().length === 0 || password.length === 0 || confirmPassword.length === 0) {
      setErrorMessage('Complete all fields before creating your account.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = await signUp(email, password);
      const successMessage = payload.requiresEmailConfirmation
        ? 'Check your email to confirm your account, then sign in.'
        : 'Account created. Sign in to continue.';

      navigation.replace('Login', { successMessage });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Unable to create your account right now. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.surface} useGradient={true}>
      <View style={styles.content}>
        {/* Upper section with branding */}
        <View style={styles.brandSection}>
          <Text style={styles.logo}>Sakai</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the commuter community</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholderTextColor={COLORS.subText}
            value={email}
            onChangeText={setEmail}
            editable={!isSubmitting}
          />
          <View style={styles.passwordField}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              secureTextEntry={!isPasswordVisible}
              placeholderTextColor={COLORS.subText}
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
            />
            <TouchableOpacity
              onPress={() => setIsPasswordVisible((currentValue) => !currentValue)}
              style={styles.eyeButton}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <HugeiconsIcon
                icon={isPasswordVisible ? ViewOffIcon : ViewIcon}
                size={20}
                color={COLORS.subText}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.passwordField}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm password"
              secureTextEntry={!isConfirmPasswordVisible}
              placeholderTextColor={COLORS.subText}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isSubmitting}
            />
            <TouchableOpacity
              onPress={() => setIsConfirmPasswordVisible((currentValue) => !currentValue)}
              style={styles.eyeButton}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <HugeiconsIcon
                icon={isConfirmPasswordVisible ? ViewOffIcon : ViewIcon}
                size={20}
                color={COLORS.subText}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={() => {
              void handleSubmit();
            }}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.toggleText}>
              Already have an account? <Text style={styles.toggleLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  brandSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: SPACING.xl,
  },
  logo: {
    fontSize: TYPOGRAPHY.fontSizes.hero,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.hero,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.subText,
  },
  form: {
    paddingBottom: SPACING.lg,
  },
  errorText: {
    marginBottom: SPACING.md,
    color: COLORS.danger,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    marginBottom: SPACING.md,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: SPACING.md + 2,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  eyeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
  footer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    color: COLORS.subText,
    fontFamily: FONTS.regular,
  },
  toggleLink: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
});
