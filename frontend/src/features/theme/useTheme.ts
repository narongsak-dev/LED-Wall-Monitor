import { useEffect } from 'react';
import { useThemeStore } from './store';

export function useApplyTheme() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);
}

export function useTheme() {
  return useThemeStore((s) => s.mode);
}
