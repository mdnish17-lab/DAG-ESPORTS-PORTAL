import type { CSSProperties } from 'react';

// Per-team logo + accent colors. Ladies = dark pink, Montrix = lighter pink.
export const TEAM_THEMES: Record<string, {
  logo: string;
  accent: string;
  dark: string;
  deep: string;
  glow: string;
  glowSoft: string;
}> = {
  'DAG Ladies': {
    logo: '/ladies.jpeg',
    accent: '#c8196b',
    dark: '#9e1254',
    deep: '#2a0a18',
    glow: 'rgba(200,25,107,0.55)',
    glowSoft: 'rgba(200,25,107,0.22)',
  },
  'DAG Montrix': {
    logo: '/montrix.jpeg',
    accent: '#ff6eb4',
    dark: '#e24c97',
    deep: '#3a1226',
    glow: 'rgba(255,110,180,0.5)',
    glowSoft: 'rgba(255,110,180,0.2)',
  },
};

export function getTeamTheme(team: string) {
  return TEAM_THEMES[team] || TEAM_THEMES['DAG Ladies'];
}

// CSS variables to put on the page's <main style={...}>
export function themeStyle(team: string): CSSProperties {
  const t = getTeamTheme(team);
  return {
    '--accent-color': t.accent,
    '--accent-dark': t.dark,
    '--accent-deep': t.deep,
    '--accent-glow': t.glow,
    '--accent-glow-soft': t.glowSoft,
  } as CSSProperties;
}