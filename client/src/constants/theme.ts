export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  white: '#FFFFFF',
  black: '#000000',
  background: '#f0f4f8',
  danger: '#FF3B30',
  border: '#cccccc',
  text: '#333333',
  subText: '#666666',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
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
