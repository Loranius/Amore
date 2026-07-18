// ============================================================
// TOAST PROVIDER — тости знизу + глобальний перехоплювач помилок
// ------------------------------------------------------------
// Порт lib/error-boundary.js: showToast(msg, type) стає useToast(),
// а глобальні window-слухачі (unhandledrejection / error) вішаються
// один раз тут. Мережеві збої → тост «Немає з'єднання…», решта —
// нейтральний тост, сайт не ламаємо.
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isRetryable } from '@/lib/errors';

type ToastType = 'success' | 'warn' | 'error';
interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((msg: string, type: ToastType = 'error') => {
    const id = nextId.current++;
    // Один тост за раз (як старий #eb-toast, що затирав попередній).
    setToasts([{ id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), DURATION);
  }, []);

  // ── Глобальні перехоплювачі (порт ErrorBoundary.init) ───────
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: unknown = e.reason;
      const msg = String(
        (reason && typeof reason === 'object' && 'message' in reason
          ? (reason as { message: unknown }).message
          : reason) ?? '',
      );
      if (!msg) return;
      e.preventDefault();

      if (isRetryable(reason)) {
        show("Немає з'єднання. Дані можуть бути застарілими.", 'error');
        return;
      }
      const low = msg.toLowerCase();
      // Supabase auth-помилки обробляються в AuthProvider — ігноруємо.
      if (low.includes('jwt') || low.includes('auth') || low.includes('session')) return;

      console.error('[Toast] unhandled:', reason);
      show('Сталася помилка. Якщо щось не працює — онови сторінку.', 'error');
    };

    const onError = (e: ErrorEvent) => {
      if (e.error && !String(e.message).includes('Script error')) {
        console.error('[Toast] JS error:', e.error);
      }
    };

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, [show]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role="status">
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast має викликатись усередині <ToastProvider>');
  return ctx;
}
