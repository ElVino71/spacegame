export type ThemeId = 'retro-scifi' | 'biological' | 'steampunk' | 'military' | 'alien';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;

  // Core colors
  bgPrimary: string;
  bgSecondary: string;
  borderColor: string;
  borderGlow: string;
  accentPrimary: string;
  accentSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  good: string;
  warn: string;
  bad: string;

  // Bar colors
  barHull: string;
  barFuel: string;
  barCargo: string;

  // Frame styling
  borderWidth: string;
  borderStyle: string;
  cornerRadius: string;
  cornerSize: string;
  fontPrimary: string;
  fontHeading: string;

  // Effects
  glowIntensity: string;
  scanlineOpacity: string;
  animationSpeed: string;

  // Corner decoration type
  cornerDecor: 'sharp' | 'rounded' | 'gear' | 'angular' | 'hazard';
  edgeDecor: 'scanlines' | 'veins' | 'rivets' | 'stripes' | 'crystals';
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  'retro-scifi': {
    id: 'retro-scifi',
    name: 'Retro Sci-Fi',
    description: 'Classic CRT terminal aesthetic',

    bgPrimary: '#0a0a1a',
    bgSecondary: '#0d1117',
    borderColor: '#00ff88',
    borderGlow: '#00ff8844',
    accentPrimary: '#00ff88',
    accentSecondary: '#00aaff',
    textPrimary: '#ccddcc',
    textSecondary: '#88aa88',
    textMuted: '#445566',
    good: '#00ff88',
    warn: '#ffaa00',
    bad: '#ff4444',

    barHull: '#00ff88',
    barFuel: '#ffcc00',
    barCargo: '#00aaff',

    borderWidth: '2px',
    borderStyle: 'solid',
    cornerRadius: '0px',
    cornerSize: '24px',
    fontPrimary: "'Share Tech Mono', monospace",
    fontHeading: "'Share Tech Mono', monospace",

    glowIntensity: '8px',
    scanlineOpacity: '0.04',
    animationSpeed: '2s',

    cornerDecor: 'sharp',
    edgeDecor: 'scanlines',
  },

  'biological': {
    id: 'biological',
    name: 'Biological',
    description: 'Living organic ship',

    bgPrimary: '#0d0a12',
    bgSecondary: '#150e1e',
    borderColor: '#cc66aa',
    borderGlow: '#cc66aa44',
    accentPrimary: '#ff88cc',
    accentSecondary: '#aa66ff',
    textPrimary: '#e0ccdd',
    textSecondary: '#aa8899',
    textMuted: '#665566',
    good: '#88ff66',
    warn: '#ffaa44',
    bad: '#ff4466',

    barHull: '#88ff66',
    barFuel: '#ffaa44',
    barCargo: '#aa66ff',

    borderWidth: '3px',
    borderStyle: 'solid',
    cornerRadius: '16px',
    cornerSize: '32px',
    fontPrimary: "'Share Tech Mono', monospace",
    fontHeading: "'Share Tech Mono', monospace",

    glowIntensity: '12px',
    scanlineOpacity: '0',
    animationSpeed: '3s',

    cornerDecor: 'rounded',
    edgeDecor: 'veins',
  },

  'steampunk': {
    id: 'steampunk',
    name: 'Steampunk',
    description: 'Victorian brass and rivets',

    bgPrimary: '#1a1208',
    bgSecondary: '#231a0e',
    borderColor: '#cc9933',
    borderGlow: '#cc993344',
    accentPrimary: '#ffcc44',
    accentSecondary: '#cc8833',
    textPrimary: '#e8d5aa',
    textSecondary: '#aa9966',
    textMuted: '#776644',
    good: '#88cc44',
    warn: '#ffaa00',
    bad: '#cc4422',

    barHull: '#88cc44',
    barFuel: '#ff8800',
    barCargo: '#cc9933',

    borderWidth: '3px',
    borderStyle: 'double',
    cornerRadius: '4px',
    cornerSize: '28px',
    fontPrimary: "'Share Tech Mono', monospace",
    fontHeading: "'Share Tech Mono', monospace",

    glowIntensity: '4px',
    scanlineOpacity: '0',
    animationSpeed: '4s',

    cornerDecor: 'gear',
    edgeDecor: 'rivets',
  },

  'military': {
    id: 'military',
    name: 'Military',
    description: 'Utilitarian naval operations',

    bgPrimary: '#0a0c0e',
    bgSecondary: '#12161a',
    borderColor: '#ff8800',
    borderGlow: '#ff880044',
    accentPrimary: '#ff8800',
    accentSecondary: '#888888',
    textPrimary: '#dddddd',
    textSecondary: '#999999',
    textMuted: '#555555',
    good: '#44cc44',
    warn: '#ffaa00',
    bad: '#ff2222',

    barHull: '#44cc44',
    barFuel: '#ffaa00',
    barCargo: '#ff8800',

    borderWidth: '3px',
    borderStyle: 'solid',
    cornerRadius: '2px',
    cornerSize: '20px',
    fontPrimary: "'Share Tech Mono', monospace",
    fontHeading: "'Share Tech Mono', monospace",

    glowIntensity: '2px',
    scanlineOpacity: '0',
    animationSpeed: '1.5s',

    cornerDecor: 'hazard',
    edgeDecor: 'stripes',
  },

  'alien': {
    id: 'alien',
    name: 'Alien',
    description: 'Mysterious crystalline technology',

    bgPrimary: '#060812',
    bgSecondary: '#0a0e1e',
    borderColor: '#6644ff',
    borderGlow: '#6644ff66',
    accentPrimary: '#88aaff',
    accentSecondary: '#cc66ff',
    textPrimary: '#ccccff',
    textSecondary: '#8888bb',
    textMuted: '#555577',
    good: '#44ffcc',
    warn: '#ffcc44',
    bad: '#ff4488',

    barHull: '#44ffcc',
    barFuel: '#ffcc44',
    barCargo: '#cc66ff',

    borderWidth: '2px',
    borderStyle: 'solid',
    cornerRadius: '0px',
    cornerSize: '30px',
    fontPrimary: "'Share Tech Mono', monospace",
    fontHeading: "'Share Tech Mono', monospace",

    glowIntensity: '14px',
    scanlineOpacity: '0.02',
    animationSpeed: '2.5s',

    cornerDecor: 'angular',
    edgeDecor: 'crystals',
  },
};
