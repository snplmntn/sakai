import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Home01Icon, UserIcon, Mic01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { COLORS, RADIUS, FONTS } from '../constants/theme';
import { useVoiceSearchTrigger } from '../voice/VoiceSearchContext';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isListening, requestToggle } = useVoiceSearchTrigger();
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

  const handleMicPress = () => {
    navigation.navigate('Home');
    requestToggle();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, isListening && styles.fabActive]}
          onPress={handleMicPress}
          activeOpacity={0.8}
        >
          <HugeiconsIcon
            icon={isListening ? Cancel01Icon : Mic01Icon}
            size={28}
            color={COLORS.white}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;

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
            <React.Fragment key={route.key}>
              {index === 1 && <View style={styles.fabSpacer} />}
              <TouchableOpacity
                style={styles.tab}
                onPress={onPress}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={index === 0 ? Home01Icon : UserIcon}
                  size={24}
                  color={iconColor}
                />
                <Animated.Text
                  style={[styles.label, { color: iconColor }]}
                >
                  {label}
                </Animated.Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    backgroundColor: COLORS.white,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 12,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: FONTS.medium,
  },
  fabSpacer: {
    width: 72,
  },
  fabContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: -28,
    zIndex: 10,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  fabActive: {
    backgroundColor: COLORS.primary,
  },
});
