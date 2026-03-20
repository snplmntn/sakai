import { ScrollView, StyleSheet, View } from 'react-native';

import NavigationAlarmCard from '../components/NavigationAlarmCard';
import SafeScreen from '../components/SafeScreen';
import { COLORS, SPACING } from '../constants/theme';

export default function NavigationAlarmScreen() {
  return (
    <SafeScreen backgroundColor={COLORS.white} topInsetBackgroundColor={COLORS.white} statusBarStyle="dark">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <NavigationAlarmCard />
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SPACING.xxl,
  },
  body: {
    padding: SPACING.lg,
  },
});
