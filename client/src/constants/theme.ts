export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  white: '#FFFFFF',
  black: '#000000',
  surface: '#F4F7F9',
  background: '#FFFFFF',
  gradientStart: '#F7FBFE',
  gradientEnd: '#DDEBF4',
  card: '#FFFFFF',
  danger: '#FF3B30',
  border: '#E0E0E0',
  text: '#1A1A1A',
  subText: '#757575',
  success: '#34C759',
  warning: '#FF9500',
  info: '#5AC8FA',
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const GRADIENTS = {
  soft: [COLORS.gradientStart, COLORS.gradientEnd] as [string, string],
};

export const TYPOGRAPHY = {
  fontSizes: {
    small: 12,
    medium: 16,
    large: 20,
    xlarge: 24,
    title: 28,
    hero: 32,
  },
  fontWeights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: 'bold' as const,
  },
};

export const globalStyles = {
  COLORS,
  SPACING,
  TYPOGRAPHY,
};

export default globalStyles;
