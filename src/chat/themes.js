// =============================================================================
// themes.js — Theme management for ShadowChat 2.0
// =============================================================================

export const THEMES = [
  {
    id: 0,
    name: 'Shadow (Por defecto)',
    color: '#00f5d4', // accent color for the selector
    vars: {
      '--ch-bg': '#0a0a0f',
      '--ch-sent-bg': 'linear-gradient(135deg,rgba(0,245,212,0.12),rgba(0,212,170,0.08))',
      '--ch-sent-border': '1px solid rgba(0,245,212,0.1)',
      '--ch-recv-bg': 'rgba(255,255,255,0.04)',
      '--ch-recv-border': '1px solid rgba(255,255,255,0.06)'
    }
  },
  {
    id: 1,
    name: 'Océano Profundo',
    color: '#3a86ff',
    vars: {
      '--ch-bg': '#0b132b',
      '--ch-sent-bg': 'linear-gradient(135deg,rgba(58,134,255,0.2),rgba(58,134,255,0.1))',
      '--ch-sent-border': '1px solid rgba(58,134,255,0.2)',
      '--ch-recv-bg': 'rgba(255,255,255,0.05)',
      '--ch-recv-border': '1px solid rgba(255,255,255,0.08)'
    }
  },
  {
    id: 2,
    name: 'Carmesí',
    color: '#e63946',
    vars: {
      '--ch-bg': '#1a0b0f',
      '--ch-sent-bg': 'linear-gradient(135deg,rgba(230,57,70,0.2),rgba(230,57,70,0.1))',
      '--ch-sent-border': '1px solid rgba(230,57,70,0.2)',
      '--ch-recv-bg': 'rgba(255,255,255,0.05)',
      '--ch-recv-border': '1px solid rgba(255,255,255,0.08)'
    }
  },
  {
    id: 3,
    name: 'Medianoche',
    color: '#a855f7',
    vars: {
      '--ch-bg': '#0d0221',
      '--ch-sent-bg': 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(168,85,247,0.1))',
      '--ch-sent-border': '1px solid rgba(168,85,247,0.2)',
      '--ch-recv-bg': 'rgba(255,255,255,0.05)',
      '--ch-recv-border': '1px solid rgba(255,255,255,0.08)'
    }
  },
  {
    id: 4,
    name: 'Bosque Negro',
    color: '#2d6a4f',
    vars: {
      '--ch-bg': '#081c15',
      '--ch-sent-bg': 'linear-gradient(135deg,rgba(45,106,79,0.3),rgba(45,106,79,0.15))',
      '--ch-sent-border': '1px solid rgba(45,106,79,0.3)',
      '--ch-recv-bg': 'rgba(255,255,255,0.05)',
      '--ch-recv-border': '1px solid rgba(255,255,255,0.08)'
    }
  }
];

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === Number(themeId)) || THEMES[0];
  for (const [key, value] of Object.entries(theme.vars)) {
    document.documentElement.style.setProperty(key, value);
  }
}
