/**
 * Escala Simples - Color Palette
 * Apple-inspired design system with refined color tokens
 */

export const colors = {
  // Primary - Refined Purple (inspired by Apple's purple)
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED', // Main brand color
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Neutral - Apple-style gray scale (cooler tones)
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Semantic colors - iOS-inspired
  success: {
    light: '#D1FAE5',
    main: '#34C759', // iOS green
    dark: '#059669',
  },
  warning: {
    light: '#FEF3C7',
    main: '#FF9500', // iOS orange
    dark: '#D97706',
  },
  error: {
    light: '#FEE2E2',
    main: '#FF3B30', // iOS red
    dark: '#DC2626',
  },
  info: {
    light: '#DBEAFE',
    main: '#007AFF', // iOS blue
    dark: '#2563EB',
  },

  // Background - Apple-style layered backgrounds
  background: {
    primary: '#FFFFFF',
    secondary: '#F2F2F7', // iOS system gray 6
    tertiary: '#E5E5EA', // iOS system gray 5
    elevated: '#FFFFFF',
    grouped: '#F2F2F7',
  },

  // Text - Following Apple's text hierarchy
  text: {
    primary: '#000000',
    secondary: '#3C3C43', // 60% opacity equivalent
    tertiary: '#8E8E93', // iOS secondary label
    quaternary: '#C7C7CC',
    inverse: '#FFFFFF',
    disabled: '#C7C7CC',
    link: '#007AFF',
  },

  // Border - Refined separators
  border: {
    light: 'rgba(60, 60, 67, 0.1)', // iOS separator
    medium: 'rgba(60, 60, 67, 0.2)',
    dark: 'rgba(60, 60, 67, 0.3)',
  },

  // iOS System Colors
  system: {
    blue: '#007AFF',
    green: '#34C759',
    indigo: '#5856D6',
    orange: '#FF9500',
    pink: '#FF2D55',
    purple: '#AF52DE',
    red: '#FF3B30',
    teal: '#5AC8FA',
    yellow: '#FFCC00',
  },

  // Overlay
  overlay: {
    light: 'rgba(0, 0, 0, 0.04)',
    medium: 'rgba(0, 0, 0, 0.3)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },
} as const;

export type ColorToken = typeof colors;
