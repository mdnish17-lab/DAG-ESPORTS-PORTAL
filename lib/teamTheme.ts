import type { CSSProperties } from 'react';

export const TEAM_DIVISIONS = {
  'Men Division': ['DAG Esports', 'DAG Inferyx', 'DAG Ascend', 'DAG Junior'],
  'Ladies Division': ['DAG Ladies', 'DAG Montrix', 'DAG Valkyrie'],
} as const;

export const TEAMS: string[] = Object.values(TEAM_DIVISIONS).flat();
export type TeamDivision = keyof typeof TEAM_DIVISIONS;
export const DEFAULT_TEAM = 'DAG Ladies';
export const isDagTeam = (value: string): boolean => TEAMS.includes(value);

type TeamTheme = {
  logo: string;
  accent: string;
  dark: string;
  deep: string;
  glow: string;
  glowSoft: string;
};
export const TEAM_THEMES: Record<string, TeamTheme> = {
  'DAG Esports': {
    logo: '/team-logos/dag-esports.webp', accent: '#ef442b',
    dark: '#b92b24', deep: '#281112', glow: 'rgba(239,68,43,0.52)', glowSoft: 'rgba(239,68,43,0.21)',
  },
  'DAG Inferyx': {
    logo: '/team-logos/dag-inferyx.webp', accent: '#f0a51e',
    dark: '#b95c15', deep: '#29130e', glow: 'rgba(240,165,30,0.48)', glowSoft: 'rgba(240,165,30,0.20)',
  },
  'DAG Ascend': {
    logo: '/team-logos/dag-ascend.webp', accent: '#f04430',
    dark: '#b02020', deep: '#291010', glow: 'rgba(240,68,48,0.52)', glowSoft: 'rgba(240,68,48,0.20)',
  },
  'DAG Junior': {
    logo: '/team-logos/dag-junior.webp', accent: '#f4b323',
    dark: '#af581b', deep: '#28130b', glow: 'rgba(244,179,35,0.48)', glowSoft: 'rgba(244,179,35,0.20)',
  },
  'DAG Ladies': {
    logo: '/ladies.jpeg', accent: '#c8196b',
    dark: '#9e1254', deep: '#2a0a18', glow: 'rgba(200,25,107,0.55)', glowSoft: 'rgba(200,25,107,0.22)',
  },
  'DAG Montrix': {
    logo: '/montrix.jpeg', accent: '#ff6eb4',
    dark: '#e24c97', deep: '#3a1226', glow: 'rgba(255,110,180,0.5)', glowSoft: 'rgba(255,110,180,0.2)',
  },
  'DAG Valkyrie': {
    logo: '/team-logos/dag-valkyrie.webp', accent: '#f47b20',
    dark: '#ad4c16', deep: '#25140e', glow: 'rgba(244,123,32,0.50)', glowSoft: 'rgba(244,123,32,0.20)',
  },
};

export const getTeamTheme = (team: string): TeamTheme => TEAM_THEMES[team] || TEAM_THEMES[DEFAULT_TEAM];
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
