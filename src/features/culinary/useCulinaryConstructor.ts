// ============================================================
// useCulinaryConstructor — майстер конструктора страв (порт CUL_* стану)
// ------------------------------------------------------------
// Замінює глобальні culStep/culAnswers/culDish/culAvoid на React-стан.
// Крок → чипси (multi з лімітом / single) → invoke('culinary-ai').
// Результат валідується guard'ом isCulinaryDish; реальну причину
// помилки дістаємо з тіла відповіді функції (invokeFn повертає
// не-2xx тіло як типізований результат). Persist у localStorage,
// щоб згенерована страва пережила перезавантаження.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { invokeFn } from '@/lib/supabase';
import { isCulinaryDish } from '@/lib/guards';
import { CUL_STEPS } from './culinaryConstants';
import type { CulinaryDish, CulinaryAnswers, CulinaryPersistedState } from '@/types';

const LS_KEY = 'amore:culinary';

function loadPersisted(): CulinaryPersistedState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as CulinaryPersistedState;
    return saved.dish && isCulinaryDish(saved.dish) ? saved : null;
  } catch {
    return null;
  }
}

export function useCulinaryConstructor() {
  const persisted = useRef(loadPersisted());

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<CulinaryAnswers>(persisted.current?.answers ?? {});
  const [dish, setDish] = useState<CulinaryDish | null>(persisted.current?.dish ?? null);
  // avoid — назви вже запропонованих страв (для «інший варіант»).
  const avoid = useRef<string[]>(persisted.current?.avoid ?? []);

  const persist = useCallback((next: CulinaryDish | null) => {
    try {
      const state: CulinaryPersistedState = { dish: next, answers, avoid: avoid.current };
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [answers]);

  const current = CUL_STEPS[step]!;
  const chosen = answers[current.key] ?? [];
  const isLast = step === CUL_STEPS.length - 1;
  const canNext = chosen.length > 0;

  // Вибір чипа: multi (toggle з лімітом max) або single.
  const select = useCallback(
    (option: string) => {
      setAnswers((prev) => {
        const sel = prev[current.key] ?? [];
        let next: string[];
        if (current.multi) {
          if (sel.includes(option)) next = sel.filter((x) => x !== option);
          else if (sel.length < (current.max ?? 99)) next = [...sel, option];
          else next = sel;
        } else {
          next = [option];
        }
        return { ...prev, [current.key]: next };
      });
    },
    [current],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, CUL_STEPS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const generateMut = useMutation({
    mutationFn: async (): Promise<CulinaryDish> => {
      const data = await invokeFn('culinary-ai', { answers, avoid: avoid.current });
      if (!isCulinaryDish(data)) {
        // invokeFn повертає тіло функції навіть на помилці — дістаємо .error.
        const detail = (data as { error?: unknown }).error;
        throw new Error(typeof detail === 'string' ? detail : 'Не вдалося згенерувати страву');
      }
      return data;
    },
    onSuccess: (result) => {
      avoid.current = [...avoid.current, result.title];
      setDish(result);
      persist(result);
    },
  });

  const generate = useCallback(() => generateMut.mutate(), [generateMut]);

  const reset = useCallback(() => {
    setStep(0);
    setAnswers({});
    setDish(null);
    avoid.current = [];
    generateMut.reset();
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }, [generateMut]);

  // Статус екрана: результат → страва; інакше майстер (loading/error — з мутації).
  const status: 'wizard' | 'loading' | 'result' | 'error' = generateMut.isPending
    ? 'loading'
    : dish
      ? 'result'
      : generateMut.isError
        ? 'error'
        : 'wizard';

  // Тримаємо persist актуальним при зміні відповідей, якщо вже є страва.
  useEffect(() => {
    if (dish) persist(dish);
  }, [dish, persist]);

  return {
    steps: CUL_STEPS,
    step,
    current,
    chosen,
    answers,
    dish,
    isLast,
    canNext,
    status,
    error: generateMut.error instanceof Error ? generateMut.error.message : null,
    select,
    next,
    back,
    generate,
    reset,
  };
}
