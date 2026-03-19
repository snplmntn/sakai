import React from 'react';
import { StyleSheet, ViewStyle, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS } from '../constants/theme';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  statusBarStyle?: StatusBarStyle;
  backgroundColor?: string;
  topInsetBackgroundColor?: string;
  useGradient?: boolean;
}

const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  style,
  statusBarStyle = 'dark',
  backgroundColor = COLORS.white,
  topInsetBackgroundColor = COLORS.white,
  useGradient = false,
}) => {
  const insets = useSafeAreaInsets();

  const content = (
    <View style={styles.container}>
      <View
        style={[
          styles.topInset,
          {
            height: insets.top,
            backgroundColor: topInsetBackgroundColor,
          },
        ]}
      />
      <StatusBar style={statusBarStyle} backgroundColor={topInsetBackgroundColor} />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, style]}>
        {children}
      </SafeAreaView>
    </View>
  );

  if (useGradient) {
    return (
      <LinearGradient
        colors={GRADIENTS.soft}
        style={[styles.container, style]}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topInset: {
    width: '100%',
  },
});

export default SafeScreen;
