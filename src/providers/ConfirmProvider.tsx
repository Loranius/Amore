// ============================================================
// CONFIRM PROVIDER — стилізована заміна window.confirm()
// ------------------------------------------------------------
// Той самий патерн, що ToastProvider: контекст + один глобальний
// стан + модалка, змонтована один раз у main.tsx. useConfirm()
// повертає async-функцію — виклики міняються з
// `if (confirm('X')) action()` на `if (await confirm('X')) action()`,
// решта логіки не чіпається.
// ============================================================
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Червона (небезпечна) кнопка підтвердження замість звичайної рожевої. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  message: string;
  resolve: (v: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending({ message, resolve, ...options });
    });
  }, []);

  const settle = (v: boolean) => {
    resolveRef.current?.(v);
    resolveRef.current = null;
    setPending(null);
  };

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && settle(false)}>
          <div className="modal-sheet" role="alertdialog" aria-modal="true">
            <p className="confirm-message">{pending.message}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
                {pending.cancelLabel ?? 'Скасувати'}
              </button>
              <button
                type="button"
                className={pending.danger ? 'btn btn-danger' : 'btn'}
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.confirmLabel ?? 'Так'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm має викликатись усередині <ConfirmProvider>');
  return ctx.confirm;
}
