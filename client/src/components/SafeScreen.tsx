import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import { COLORS } from '../constants/theme';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  statusBarStyle?: StatusBarStyle;
  backgroundColor?: string;
}

const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  style,
  statusBarStyle = 'auto',
  backgroundColor = COLORS.white,
}) => {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }, style]}>
      <StatusBar style={statusBarStyle} />
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeScreen;
