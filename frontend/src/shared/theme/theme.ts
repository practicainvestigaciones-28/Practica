export const colors = {
  primary: '#263d70',
  primaryDark: '#1e3159',
  accent: '#4a63a0',
  focus: '#405a96',
  focusRing: 'rgba(64, 90, 150, 0.15)',

  danger: '#a02020',
  dangerAlt: '#c0392b',
  dangerBg: '#fbeaea',
  dangerBgAlt: '#fdecea',
  success: '#27ae60',
  warning: '#d9a017',

  border: '#d5d5d5',
  borderLight: '#f0f0f0',
  borderMuted: '#e5e5e5',

  bgLight: '#f2f4f9',
  bgLighter: '#f7f8fa',
  bgHeaderLight: '#d9e3f3',
  bgHover: '#eef1f8',

  text: '#333333',
  textMuted: '#777777',
  white: '#ffffff',
} as const

export const radii = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  pill: '14px',
} as const

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
} as const

export type ColorToken = keyof typeof colors
