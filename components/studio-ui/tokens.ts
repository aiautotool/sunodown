export const STUDIO_THEME = {
  version: '1.0.0',
  radius: { sm: 8, md: 10, lg: 12, xl: 16 },
  controlHeight: { sm: 30, md: 40, lg: 48 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
} as const;

export type StudioTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';
export type StudioSize = 'sm' | 'md' | 'lg';
