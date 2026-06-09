import type { ThemeMode } from './store';

export interface ChartTheme {
  axis: string;
  label: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

export const CHART_THEMES: Record<ThemeMode, ChartTheme> = {
  dark: {
    axis: '#30363d',
    label: '#8b949e',
    grid: 'rgba(48, 54, 61, 0.3)',
    tooltipBg: '#161b22',
    tooltipBorder: '#30363d',
    tooltipText: '#e6edf3',
  },
  light: {
    axis: '#d9dee5',
    label: '#6b7280',
    grid: 'rgba(217, 222, 229, 0.6)',
    tooltipBg: '#ffffff',
    tooltipBorder: '#d9dee5',
    tooltipText: '#1a1f2e',
  },
};
