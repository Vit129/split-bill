// Design tokens. The only src file allowed to hold colour hex values
// (tests/architecture-guard.test.js enforces it). ui/ reads them as CSS variables.
export const COLORS = {
  INK: '#18181B',
  INK_SOFT: '#3F3F46',
  MUTED: '#71717A',
  LINE: '#E4E4E7',
  CANVAS: '#F4F4F5',
  SURFACE: '#FFFFFF',
  SUCCESS: '#047857',
  SUCCESS_SOFT: '#ECFDF5',
  WARNING: '#B45309',
  WARNING_SOFT: '#FFFBEB',
  DANGER: '#B91C1C',
  DANGER_SOFT: '#FEF2F2',
  PLATE: {
    white: '#F4F4F5',
    red: '#D7000F',
    silver: '#94A3B8',
    gold: '#D4AF37',
    black: '#18181B',
    green: '#16A34A',
    blue: '#2563EB',
    orange: '#EA580C',
  },
  BRAND: {
    sushiro: { primary: '#D7000F', soft: '#FEF2F2', border: '#FECACA' },
    hama: { primary: '#0284C7', soft: '#F0F9FF', border: '#BAE6FD' },
    katsumidori: { primary: '#B45309', soft: '#FFFBEB', border: '#FDE68A' },
    onodera: { primary: '#1E293B', soft: '#F1F5F9', border: '#CBD5E1' },
    genki: { primary: '#EA580C', soft: '#FFF7ED', border: '#FED7AA' },
  },
};
