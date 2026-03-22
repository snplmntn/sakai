import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Home01Icon, UserIcon } from '@hugeicons/core-free-icons';
import { COLORS, FONTS, RADIUS } from '../constants/theme';

const TAB_ICONS: Record<string, object> = {
  Home: Home01Icon,
  Profile: UserIcon,
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const focusedOptions = descriptors[state.routes[state.index]?.key]?.options;
  const flattenedTabBarStyle = StyleSheet.flatten(focusedOptions?.tabBarStyle);
  const isTabBarHidden =
    typeof flattenedTabBarStyle === 'object' &&
    flattenedTabBarStyle !== null &&
    'display' in flattenedTabBarStyle &&
    flattenedTabBarStyle.display === 'none';

  if (isTabBarHidden) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;
          const icon = TAB_ICONS[route.name] ?? Home01Icon;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconColor = isFocused ? COLORS.primary : '#B0B8C1';

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.tab, isFocused && styles.tabActive]}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <HugeiconsIcon icon={icon} size={22} color={iconColor} />
              <Text style={[styles.label, { color: iconColor }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E7EEF4',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 10,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#EEF5FF',
  },
  label: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    letterSpacing: 0.1,
  },
});
