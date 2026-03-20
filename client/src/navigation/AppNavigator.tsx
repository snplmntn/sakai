import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingRoutePreferenceScreen from '../screens/OnboardingRoutePreferenceScreen';
import OnboardingPassengerProfileScreen from '../screens/OnboardingPassengerProfileScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import AuthLoadingScreen from '../screens/auth/AuthLoadingScreen';
import CommunityHubScreen from '../screens/CommunityHubScreen';
import CommunityQuestionDetailScreen from '../screens/CommunityQuestionDetailScreen';
import NavigationAlarmScreen from '../screens/NavigationAlarmScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import MainTabNavigator from './MainTabNavigator';
import type { CommunityLaunchDraft } from '../community/types';
import type { RoutePreference } from '../preferences/types';

export type RootStackParamList = {
  Welcome: undefined;
  OnboardingRoutePreference: undefined;
  OnboardingPassengerProfile: { defaultPreference: RoutePreference };
  Login: { successMessage?: string } | undefined;
  Signup: undefined;
  MainTabs: undefined;
  Preferences: undefined;
  NavigationAlarm: undefined;
  CommunityHub: { draft?: CommunityLaunchDraft } | undefined;
  CommunityQuestionDetail: { questionId: string };
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
        <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'Preferences' }} />
        <Stack.Screen name="NavigationAlarm" component={NavigationAlarmScreen} options={{ title: 'Navigation alarm' }} />
        <Stack.Screen
          name="CommunityHub"
          component={CommunityHubScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CommunityQuestionDetail"
          component={CommunityQuestionDetailScreen}
          options={{ title: 'Community thread' }}
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
      <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'Preferences' }} />
      <Stack.Screen name="NavigationAlarm" component={NavigationAlarmScreen} options={{ title: 'Navigation alarm' }} />
      <Stack.Screen
        name="CommunityHub"
        component={CommunityHubScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
