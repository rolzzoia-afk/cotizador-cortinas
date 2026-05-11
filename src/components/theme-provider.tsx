import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

const initial: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initial);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'rolzzo-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const root = window.document.documentElement;

    const resolve = (t: Theme): 'light' | 'dark' => {
      if (t === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return t;
    };

    const apply = (mode: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(mode);
      setResolvedTheme(mode);
    };

    apply(resolve(theme));

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => apply(resolve('system'));
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
  }, [theme]);

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    setTheme: (t: Theme) => {
      try {
        localStorage.setItem(storageKey, t);
      } catch {
        // ignore quota errors
      }
      setThemeState(t);
    },
  };

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeProviderContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
