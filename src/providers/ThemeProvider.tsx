// ============================================================
// THEME PROVIDER — одна тема, темна.
// ------------------------------------------------------------
// Світлої теми в порталі більше немає. Власник обрав гаму з референсу як
// основу всього порталу, а на ньому портал темний: «кольорова гама
// скріншоти два стає основою для усього порталу».
//
// Провайдер лишається, і це не рудимент. По-перше, він тримає
// `data-theme="dark"` на `<html>` — на цей атрибут спирається півсотні
// селекторів і `worldTheme.css`. По-друге, `useTheme()` читають сцена
// (`EvolutionCrystalPreviewScene`) і фон порталу (`PortalBackdrop`); вони
// просто завжди отримують `'dark'`, і правити їх не довелось.
//
// Контракт лишився той самий (`toggle`, `setTheme`) навмисно: обидва тепер
// нічого не роблять, але прибрати їх означало б правити виклики заради нуля
// різниці — а повернути другу тему колись стане важче.
// ============================================================
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

type Theme = 'dark';

/** Єдина тема порталу. */
const THEME: Theme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const noop = () => {};

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', THEME);
    // Android бере theme-color для тонування статус-бару/панелі задач
    // (на відміну від iOS, де за це відповідає apple-mobile-web-app-...
    // status-bar-style в index.html). Колір — той самий майже чорний
    // фіолет, що й `--bg`: смуга статусу має бути продовженням екрана, а
    // не сірою рамкою над ним.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', '#0f0a19');
  }, []);

  const value = useMemo(() => ({ theme: THEME, toggle: noop, setTheme: noop }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme має викликатись усередині <ThemeProvider>');
  return ctx;
}
