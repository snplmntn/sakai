import { useCallback, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { AuthProvider } from './src/auth/AuthContext';
import { PreferencesProvider } from './src/preferences/PreferencesContext';
import { ToastProvider } from './src/toast/ToastContext';
import AppNavigator from './src/navigation/AppNavigator';
import './src/navigation-alert/task';
import { configureArrivalNotifications } from './src/navigation-alert/notification-service';

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    void (async () => {
      await configureArrivalNotifications().catch((error: unknown) => {
        console.warn('Unable to configure arrival notifications', error);
      });
    })().catch((error: unknown) => {
      console.warn('Unable to initialize notification setup', error);
    });
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
