import React from 'react';
import { StyleSheet, ViewStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS } from '../constants/theme';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  statusBarStyle?: StatusBarStyle;
  backgroundColor?: string;
  useGradient?: boolean;
}

const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  style,
  statusBarStyle = 'auto',
  backgroundColor = COLORS.white,
  useGradient = false,
}) => {
  const content = (
    <SafeAreaView style={[styles.container, style]}>
      <StatusBar style={statusBarStyle} />
      {children}
    </SafeAreaView>
  );

  if (useGradient) {
    return (
      <LinearGradient
        colors={GRADIENTS.soft}
        style={[styles.container, { backgroundColor }]}
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
});

export default SafeScreen;
