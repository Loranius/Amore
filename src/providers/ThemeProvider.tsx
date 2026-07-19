// ============================================================
// THEME PROVIDER — світла / темна тема
// ------------------------------------------------------------
// Порт логіки теми з modules/settings.js: значення в localStorage
// 'amore:theme', застосовується як data-theme на <html>. CSS-токени
// обох тем — в index.css ([data-theme="dark"]).
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';
const THEME_KEY = 'amore:theme';

function readInitial(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'dark' || saved === 'light' ? saved : 'light';
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    // Android бере theme-color для тонування статус-бару/панелі задач
    // (на відміну від iOS, де за це відповідає apple-mobile-web-app-...
    // status-bar-style в index.html) — тримаємо його синхронним з темою.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#171717' : '#faf7f5');
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme має викликатись усередині <ThemeProvider>');
  return ctx;
}
