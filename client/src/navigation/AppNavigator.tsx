import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import AuthScreen from '../screens/auth/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  Dashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Welcome">
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ title: 'Authentication' }}
      />
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerBackVisible: false, title: 'Dashboard' }}
      />
    </Stack.Navigator>
  );
}
