import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Home01Icon, Mic01Icon, UserIcon } from '@hugeicons/core-free-icons';
import { COLORS, FONTS, RADIUS } from '../constants/theme';
import { useVoiceSearchTrigger } from '../voice/VoiceSearchContext';

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

  const { isListening, requestStart, requestStop } = useVoiceSearchTrigger();
  const isHomeActive = state.routes[state.index]?.name === 'Home';

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

      {/* Mic floater — rendered after container so it draws on top */}
      <View style={styles.micFloaterRow} pointerEvents="box-none">
        {state.routes.map((route) => {
          if (route.name !== 'Home') {
            return <View key={route.key} style={styles.micFloaterSlot} />;
          }

          return (
            <View key={route.key} style={styles.micFloaterSlot}>
              <Pressable
                style={styles.micFloaterPress}
                onPressIn={() => {
                  if (isHomeActive) requestStart();
                }}
                onPressOut={() => {
                  if (isHomeActive) requestStop();
                }}
                disabled={!isHomeActive}
              >
                <LinearGradient
                  colors={isListening ? ['#1a8fcf', '#0e6fa8'] : isHomeActive ? ['#1d3a52', '#102033'] : ['#8a9baa', '#6b7c8a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.micFloater}
                >
                  <HugeiconsIcon
                    icon={Mic01Icon}
                    size={28}
                    color={COLORS.white}
                  />
                </LinearGradient>
              </Pressable>
            </View>
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
    overflow: 'visible',
  },
  micFloaterRow: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 12,
    pointerEvents: 'box-none',
  } as object,
  micFloaterSlot: {
    flex: 1,
    alignItems: 'center',
  },
  micFloaterPress: {
    borderRadius: 36,
    shadowColor: '#102033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  micFloater: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
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
