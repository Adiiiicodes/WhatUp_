// src/theme/colors.ts
// WhatsApp Dark Theme Colors (matching mobile app)

export const colors = {
  // Background colors
  bgPrimary: '#0b141a',
  bgSecondary: '#202c33',
  bgTertiary: '#111b21',
  bgHover: '#2a3942',
  bgMessageSent: '#005c4b',
  bgMessageReceived: '#202c33',

  // Text colors
  textPrimary: '#e9edef',
  textSecondary: '#8696a0',
  textTertiary: '#667781',

  // Border colors
  borderPrimary: '#2a3942',

  // Accent colors
  accentPrimary: '#00a884',
  accentHover: '#06cf9c',

  // Icon colors
  iconPrimary: '#aebac1',
  iconSecondary: '#8696a0',

  // Status colors
  onlineStatus: '#25d366',
  tickRead: '#53bdeb',
  tickUnread: '#8696a0',

  // Semantic colors
  danger: '#ea4335',
  success: '#25d366',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Base colors
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

// Spacing scale (matching mobile)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Border radius scale
export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Font sizes
export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
} as const;

// Font weights
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Shadow presets
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.3)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.3)',
} as const;

// Type exports for TypeScript
export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type BorderRadiusKey = keyof typeof borderRadius;
export type FontSizeKey = keyof typeof fontSize;
export type FontWeightKey = keyof typeof fontWeight;

export default {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
};
