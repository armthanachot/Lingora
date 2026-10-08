import { useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'auto' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'lingora-theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'auto' || value === 'dark';
}

function storedPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => storedPreference());
  const [systemResolvedTheme, setSystemResolvedTheme] = useState<ResolvedTheme>(() => systemTheme());

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemResolvedTheme(media.matches ? 'dark' : 'light');
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const resolvedTheme = useMemo<ResolvedTheme>(
    () => (preference === 'auto' ? systemResolvedTheme : preference),
    [preference, systemResolvedTheme],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolvedTheme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', resolvedTheme === 'dark' ? '#09111f' : '#f7fbff');
  }, [preference, resolvedTheme]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The selected theme still applies for this tab when storage is unavailable.
    }
  }

  return { preference, resolvedTheme, setPreference };
}
