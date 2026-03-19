import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import SafeScreen from '../../components/SafeScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: { navigation: NavigationProp }) {
  const handleSubmit = () => {
    navigation.replace('MainTabs');
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
          <TextInput
            style={styles.input}
            placeholder="Email address"
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

          <TouchableOpacity style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleSubmit} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Sign In</Text>
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
  },
  button: {
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
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
