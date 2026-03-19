import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  title?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

interface ToastState extends ToastOptions {
  id: number;
}

const DEFAULT_TOAST_DURATION_MS = 3200;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const getToastTitle = (tone: ToastTone, explicitTitle?: string): string => {
  if (explicitTitle) {
    return explicitTitle;
  }

  if (tone === 'success') {
    return 'Success';
  }

  if (tone === 'error') {
    return 'Error';
  }

  return 'Notice';
};

const getToastPalette = (tone: ToastTone) => {
  if (tone === 'success') {
    return {
      accent: COLORS.success,
      background: '#F0FBF4',
      border: '#CBEED7',
    };
  }

  if (tone === 'error') {
    return {
      accent: COLORS.danger,
      background: '#FFF4F3',
      border: '#FFD9D6',
    };
  }

  return {
    accent: COLORS.primary,
    background: '#F1F7FF',
    border: '#D5E7FF',
  };
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-14)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearHideTimer();

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -14,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      setToast(null);
    });
  }, [clearHideTimer, opacity, translateY]);

  const showToast = useCallback((options: ToastOptions) => {
    clearHideTimer();
    setToast({
      id: Date.now(),
      durationMs: options.durationMs ?? DEFAULT_TOAST_DURATION_MS,
      message: options.message,
      title: options.title,
      tone: options.tone ?? 'info',
    });
  }, [clearHideTimer]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    setIsVisible(true);
    opacity.setValue(0);
    translateY.setValue(-14);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 16,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      hideToast();
    }, toast.durationMs ?? DEFAULT_TOAST_DURATION_MS);

    return () => {
      clearHideTimer();
    };
  }, [toast]);

  useEffect(() => () => clearHideTimer(), []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
      hideToast,
    }),
    [hideToast, showToast]
  );
  const palette = getToastPalette(toast?.tone ?? 'info');

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toast && isVisible ? (
        <View pointerEvents="box-none" style={styles.viewport}>
          <Animated.View
            style={[
              styles.toastShell,
              {
                marginTop: insets.top + SPACING.sm,
                maxWidth: Math.min(width - SPACING.lg * 2, 420),
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <Pressable
              onPress={hideToast}
              style={[
                styles.toastCard,
                {
                  backgroundColor: palette.background,
                  borderColor: palette.border,
                },
              ]}
            >
              <View
                style={[
                  styles.toastAccent,
                  {
                    backgroundColor: palette.accent,
                  },
                ]}
              />
              <View style={styles.toastBody}>
                <Text style={styles.toastTitle}>
                  {getToastTitle(toast.tone ?? 'info', toast.title)}
                </Text>
                <Text style={styles.toastMessage}>{toast.message}</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastContextValue => {
  const contextValue = useContext(ToastContext);

  if (!contextValue) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return contextValue;
};

const styles = StyleSheet.create({
  viewport: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toastShell: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  toastAccent: {
    width: 5,
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  toastBody: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  toastTitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  toastMessage: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 22,
  },
});
