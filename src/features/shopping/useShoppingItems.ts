// ============================================================
// useShoppingItems — дані вкладки «Покупки» (порт shopping.js)
// ------------------------------------------------------------
// DataCache.swr → useQuery; ручні optimistic-патчі + rollback →
// useMutation (onMutate/onError/onSettled). Придушення власної луни
// realtime вже автоматичне (monkey-patch у lib/realtime).
//
// БАГ ЗІ СТАРОГО КОДУ УСУНЕНО НА РІВНІ ТИПІВ: id — строго number.
// Оптимістичні записи отримують ВІД'ЄМНИЙ тимчасовий id; жодного
// String(id)-порівняння (саме воно ламало видалення/тогл раніше).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, invokeFn } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { toShoppingCategory } from '@/lib/guards';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type {
  ShoppingItemRow,
  InsertRow,
  ParsedShoppingLine,
  ShoppingParseResponse,
} from '@/types';

type Items = ShoppingItemRow[];

// ── Завантаження ─────────────────────────────────────────────
async function loadItems(): Promise<Items> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('id,title,qty,category,bought,created_by,bought_by,bought_at,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useShoppingItems() {
  return useQuery({ queryKey: qk.shopping(), queryFn: loadItems });
}

// ── Парсинг вводу ────────────────────────────────────────────
/** Fallback без ШІ: розділювачі — кома та новий рядок. */
export function parseInputFallback(raw: string): ParsedShoppingLine[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((title) => ({ title, qty: null, category: 'Інше' }));
}

/** Розумний парсинг через Edge Function; null → викликач бере fallback. */
async function parseInputSmart(raw: string): Promise<ParsedShoppingLine[] | null> {
  try {
    const data: ShoppingParseResponse = await invokeFn('shopping-parse', { text: raw });
    if (!Array.isArray(data.items) || !data.items.length) return null;
    return data.items.map((i) => ({
      title: String(i.title),
      qty: i.qty ?? null,
      category: toShoppingCategory(i.category),
    }));
  } catch (e) {
    console.warn('shopping-parse недоступний, fallback', e);
    return null;
  }
}

/** Розумний парсинг з деградацією до простого. Порожній ввід → []. */
export async function parseShoppingInput(raw: string): Promise<ParsedShoppingLine[]> {
  if (!raw.trim()) return [];
  const smart = await parseInputSmart(raw);
  return smart ?? parseInputFallback(raw);
}

// ── Мутації ──────────────────────────────────────────────────
export function useShoppingMutations() {
  const client = useQueryClient();
  const user = useCurrentUser();
  const toast = useToast();
  const key = qk.shopping();

  const snapshot = () => client.getQueryData<Items>(key);
  const setItems = (updater: (old: Items) => Items) =>
    client.setQueryData<Items>(key, (old) => updater(old ?? []));
  const rollback = (prev: Items | undefined) => {
    if (prev) client.setQueryData<Items>(key, prev);
  };
  const settle = () => void client.invalidateQueries({ queryKey: key });

  // ДОДАВАННЯ — оптимістичні temp-рядки (від'ємний id), потім реальні з БД.
  const add = useMutation({
    mutationFn: async (lines: ParsedShoppingLine[]) => {
      const rows: InsertRow<'shopping_items'>[] = lines.map((l) => ({
        title: l.title,
        qty: l.qty,
        category: l.category,
        created_by: user.id,
      }));
      const { error } = await supabase.from('shopping_items').insert(rows);
      if (error) throw error;
    },
    onMutate: async (lines) => {
      await client.cancelQueries({ queryKey: key });
      const prev = snapshot();
      const now = new Date().toISOString();
      const temp: Items = lines.map((l, i) => ({
        id: -(Date.now() + i), // тимчасовий від'ємний id — не сплутати з реальним
        title: l.title,
        qty: l.qty,
        category: l.category,
        bought: false,
        created_by: user.id,
        bought_by: null,
        bought_at: null,
        created_at: now,
      }));
      setItems((old) => [...temp, ...old]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      rollback(ctx?.prev);
      toast.show('Не вдалось додати товар. Спробуй ще.');
    },
    onSettled: settle, // підтягуємо реальні id
  });

  // КУПЛЕНО / ПОВЕРНУТИ.
  const toggleBought = useMutation({
    mutationFn: async (item: ShoppingItemRow) => {
      const nowBought = !item.bought;
      const { error } = await supabase
        .from('shopping_items')
        .update({
          bought: nowBought,
          bought_by: nowBought ? user.id : null,
          bought_at: nowBought ? new Date().toISOString() : null,
        })
        .eq('id', item.id);
      if (error) throw error;
    },
    onMutate: async (item) => {
      await client.cancelQueries({ queryKey: key });
      const prev = snapshot();
      const nowBought = !item.bought;
      setItems((old) =>
        old.map((i) =>
          i.id === item.id
            ? {
                ...i,
                bought: nowBought,
                bought_by: nowBought ? user.id : null,
                bought_at: nowBought ? new Date().toISOString() : null,
              }
            : i,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      rollback(ctx?.prev);
      toast.show('Не вдалось оновити товар. Спробуй ще.');
    },
    onSettled: settle,
  });

  // ВИДАЛЕННЯ.
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('shopping_items').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const prev = snapshot();
      setItems((old) => old.filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      rollback(ctx?.prev);
      toast.show('Не вдалось видалити товар. Спробуй ще.');
    },
    onSettled: settle,
  });

  // РЕДАГУВАННЯ (назва / кількість / категорія).
  const edit = useMutation({
    mutationFn: async (patch: Pick<ShoppingItemRow, 'id' | 'title' | 'qty' | 'category'>) => {
      const { error } = await supabase
        .from('shopping_items')
        .update({ title: patch.title, qty: patch.qty, category: patch.category })
        .eq('id', patch.id);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: key });
      const prev = snapshot();
      setItems((old) =>
        old.map((i) =>
          i.id === patch.id
            ? { ...i, title: patch.title, qty: patch.qty, category: patch.category }
            : i,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      rollback(ctx?.prev);
      toast.show('Не вдалось зберегти зміни');
    },
    onSettled: settle,
  });

  return { add, toggleBought, remove, edit };
}
