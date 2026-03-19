import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { RouteIcon, UserIcon } from '@hugeicons/core-free-icons';
import RoutesScreen from '../screens/RoutesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { COLORS } from '../constants/theme';

export type MainTabParamList = {
  Routes: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: COLORS.primary,
      }}
    >
      <Tab.Screen 
        name="Routes" 
        component={RoutesScreen} 
        options={{
          title: 'Routes',
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={RouteIcon} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={UserIcon} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
