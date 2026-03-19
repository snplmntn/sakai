import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingRoutePreferenceScreen from '../screens/OnboardingRoutePreferenceScreen';
import OnboardingPassengerProfileScreen from '../screens/OnboardingPassengerProfileScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import AuthLoadingScreen from '../screens/auth/AuthLoadingScreen';
import MainTabNavigator from './MainTabNavigator';
import type { RoutePreference } from '../preferences/types';

export type RootStackParamList = {
  Welcome: undefined;
  OnboardingRoutePreference: undefined;
  OnboardingPassengerProfile: { defaultPreference: RoutePreference };
  Login: { successMessage?: string } | undefined;
  Signup: undefined;
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { status, unauthenticatedRoute } = useAuth();

  if (status === 'hydrating') {
    return <AuthLoadingScreen />;
  }

  if (status === 'authenticated') {
    return (
      <Stack.Navigator key="authenticated">
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      key={`unauthenticated-${unauthenticatedRoute}`}
      initialRouteName={unauthenticatedRoute}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OnboardingRoutePreference"
        component={OnboardingRoutePreferenceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OnboardingPassengerProfile"
        component={OnboardingPassengerProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
