import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GoogleIcon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../auth/api';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import SafeScreen from '../../components/SafeScreen';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation, route }: LoginScreenProps) {
  const { signIn, authenticateWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    route.params?.successMessage ?? null
  );
  const [activeAction, setActiveAction] = useState<'email' | 'google' | null>(null);

  useEffect(() => {
    setSuccessMessage(route.params?.successMessage ?? null);
  }, [route.params?.successMessage]);

  const isSubmitting = activeAction !== null;
  const isEmailSubmitting = activeAction === 'email';
  const isGoogleSubmitting = activeAction === 'google';

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (email.trim().length === 0 || password.length === 0) {
      setErrorMessage('Enter both your email and password.');
      return;
    }

    setActiveAction('email');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await signIn(email, password);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Unable to sign in right now. Please try again.'
      );
    } finally {
      setActiveAction(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) {
      return;
    }

    setActiveAction('google');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await authenticateWithGoogle('login');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Unable to sign in with Google right now. Please try again.'
      );
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.surface} useGradient={true}>
      <View style={styles.content}>
        {/* Upper section with branding */}
        <View style={styles.brandSection}>
          <Text style={styles.logo}>Sakai</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your commute</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
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

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={() => {
              void handleSubmit();
            }}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isEmailSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.googleButton, isSubmitting && styles.buttonDisabled]}
            onPress={() => {
              void handleGoogleSignIn();
            }}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isGoogleSubmitting ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <View style={styles.googleButtonContent}>
                <HugeiconsIcon icon={GoogleIcon} size={20} color={COLORS.text} />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.toggleText}>
              Don't have an account? <Text style={styles.toggleLink}>Sign up</Text>
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
  successText: {
    marginBottom: SPACING.md,
    color: COLORS.success,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
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
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
  },
  googleButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D6E0E8',
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleButtonText: {
    marginLeft: SPACING.sm,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
  },
  footer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
  },
  toggleLink: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
});
