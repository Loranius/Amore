// ============================================================
// THEME PROVIDER — дві теми: нічна фіолетова й денна рожева.
// ------------------------------------------------------------
// Портал знову має вибір. ADR-0031 залишив одну темну тему, бо тоді
// референс був один і він був темний; власник надіслав два аркуші —
// світлий рожевий і темний фіолетовий, обидва в одній кристалічній мові
// (ADR-0040).
//
// **Темна лишається типовою, і це не смак.** `:root` у `index.css` малює
// перший кадр — до того, як цей провайдер встигне поставити атрибут. Якби
// типовою була світла, кожен холодний старт починався б рожевим спалахом,
// а §49 брифу забороняє саме це: виміряно колись 247.6 із 255 на першому
// кадрі. Тому світла вмикається явним `data-theme='light'`, а темна є
// станом за замовчуванням у CSS і тут.
//
// **Системну тему не питаємо.** Спокуса взяти `prefers-color-scheme`
// велика, але портал — не документ: його світ нічний, і пара, що ставила
// систему в світлу заради пошти, не просила про рожевий Amore. Вибір
// робиться в порталі й запамʼятовується.
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

export type Theme = 'light' | 'dark';

/** Ключ памʼяті. Той самий, що вже читає живий харнес (`--theme=light`). */
const STORAGE_KEY = 'amore:theme';

/** Колір смуги статусу на Android — продовження екрана, а не рамка над ним. */
const STATUS_BAR: Record<Theme, string> = {
  dark: '#0f0a19',
  light: '#f5dfe4',
};

function readStored(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // Приватний режим Safari кидає на доступі до сховища. Тема — не та річ,
    // заради якої портал має падати.
    return 'dark';
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', STATUS_BAR[theme]);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Приватний режим — вибір діє до кінця сеансу. */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme має викликатись усередині <ThemeProvider>');
  return ctx;
}
