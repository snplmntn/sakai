import React, { useState } from 'react';
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
import { COLORS } from '../constants/theme';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [micExpanded, setMicExpanded] = useState(false);

  const handleMicPress = () => {
    setMicExpanded(!micExpanded);
  };

  return (
    <View style={styles.wrapper}>
      {/* Floating MIC Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, micExpanded && styles.fabActive]}
          onPress={handleMicPress}
          activeOpacity={0.8}
        >
          <HugeiconsIcon
            icon={micExpanded ? Cancel01Icon : Mic01Icon}
            size={28}
            color={COLORS.white}
          />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
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

          const iconColor = isFocused ? COLORS.primary : '#999';

          // Insert spacer before Profile (index 1) for the FAB
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
  },
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
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
    fontWeight: '500',
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabActive: {
    backgroundColor: '#333',
  },
});
