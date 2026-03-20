import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../auth/api';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import SafeScreen from '../../components/SafeScreen';
import GoogleMark from '../../components/GoogleMark';

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
          : error instanceof Error
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
          : error instanceof Error
            ? error.message
            : 'Unable to sign in with Google right now. Please try again.'
      );
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.surface} topInsetBackgroundColor={COLORS.surface}>
      <View style={styles.screen}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Login to your account</Text>
          </View>

          {successMessage ? (
            <View style={[styles.notice, styles.successNotice]}>
              <Text style={[styles.noticeText, styles.successNoticeText]}>{successMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={[styles.notice, styles.errorNotice]}>
              <Text style={[styles.noticeText, styles.errorNoticeText]}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username or email"
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
                  size={18}
                  color={COLORS.subText}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={() => {
                void handleSubmit();
              }}
              activeOpacity={0.88}
              disabled={isSubmitting}
            >
              {isEmailSubmitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, isSubmitting && styles.buttonDisabled]}
              onPress={() => {
                void handleGoogleSignIn();
              }}
              activeOpacity={0.88}
              disabled={isSubmitting}
            >
              {isGoogleSubmitting ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <View style={styles.googleButtonContent}>
                  <GoogleMark size={18} />
                  <Text style={styles.googleButtonText}>Sign in with Google</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.85}>
              <Text style={styles.footerText}>
                Don&apos;t have an account? <Text style={styles.footerLink}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  card: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: SPACING.xl + SPACING.md,
    paddingBottom: SPACING.sm,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
  },
  notice: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.md,
  },
  successNotice: {
    backgroundColor: '#EEF8F0',
  },
  errorNotice: {
    backgroundColor: '#FFF1F0',
  },
  noticeText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    textAlign: 'center',
    lineHeight: 18,
  },
  successNoticeText: {
    color: COLORS.success,
  },
  errorNoticeText: {
    color: COLORS.danger,
  },
  form: {
    flex: 1,
  },
  input: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  passwordField: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    marginBottom: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  passwordInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  eyeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    textTransform: 'lowercase',
  },
  googleButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleButtonText: {
    marginLeft: SPACING.sm,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
  },
  footer: {
    paddingTop: SPACING.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
  },
  footerLink: {
    color: COLORS.text,
    fontFamily: FONTS.semibold,
  },
});
