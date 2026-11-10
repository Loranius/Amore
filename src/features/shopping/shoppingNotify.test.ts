import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  batchShoppingText,
  boughtShoppingText,
  escapeHtml,
  shoppingInsertDecision,
  singleShoppingText,
  type ShoppingRowLike,
} from '../../../supabase/functions/db-notify/shoppingRules';
import { shoppingInsertRows } from './useShoppingItems';
import { readShoppingNotify, SHOPPING_NOTIFY_KEY, writeShoppingNotify } from './shoppingNotify';

// ============================================================
// Покупки → Telegram (ADR-0262). Дві вказівки власника (2026-11-10):
// можна не надсилати сповіщення з самого модуля, а кілька товарів через
// кому — одне повідомлення списком, а не по одному.
// Правила сервера тут ті самі, що й у Edge Function (`shoppingRules.ts`
// імпортує і вона): `deno test` у проєкті не ганяється.
// ============================================================

const row = (id: number, title: string, extra: Partial<ShoppingRowLike> = {}): ShoppingRowLike => ({
  id, title, qty: null, category: 'Інше', notify: true, batch_id: null, batch_size: null, ...extra,
});

describe('рядки одного вводу (ADR-0262)', () => {
  const lines = [
    { title: 'Молоко', qty: '2 л', category: 'Молочне' as const },
    { title: 'Хліб', qty: null, category: 'Хліб' as const },
    { title: 'Яблука', qty: '1 кг', category: 'Фрукти' as const },
  ];

  it('кілька товарів — одна партія: спільний batch_id і розмір', () => {
    let calls = 0;
    const rows = shoppingInsertRows(lines as never, true, 7, () => { calls += 1; return 'batch-1'; });
    expect(calls).toBe(1);
    expect(rows.map((r) => r.batch_id)).toEqual(['batch-1', 'batch-1', 'batch-1']);
    expect(rows.every((r) => r.batch_size === 3 && r.notify === true && r.created_by === 7)).toBe(true);
  });

  it('один товар партії не має — повідомлення як раніше', () => {
    const rows = shoppingInsertRows([lines[0]!] as never, true, 7, () => 'never');
    expect(rows[0]).toMatchObject({ batch_id: null, batch_size: null, notify: true });
  });

  it('тихо — notify: false на кожному рядку', () => {
    const rows = shoppingInsertRows(lines as never, false, 7, () => 'b');
    expect(rows.every((r) => r.notify === false)).toBe(true);
  });
});

describe('рішення сервера про новий товар (ADR-0262)', () => {
  it('тихий рядок мовчить', () => {
    expect(shoppingInsertDecision(row(1, 'Молоко', { notify: false }), null)).toEqual({ kind: 'silent' });
  });

  it('один товар — одне повідомлення, як раніше', () => {
    const decision = shoppingInsertDecision(row(1, 'Молоко', { qty: '2 л', category: 'Молочне' }), null);
    expect(decision).toEqual({ kind: 'single', text: '🛒 Новий товар у списку покупок:\n<b>Молоко</b> — 2 л\n📂 Молочне' });
  });

  it('партія: спершу треба прочитати рядки, тоді надсилає лише останній — один раз', () => {
    const batch = [
      row(10, 'Молоко', { batch_id: 'b', batch_size: 3, qty: '2 л' }),
      row(11, 'Хліб', { batch_id: 'b', batch_size: 3 }),
      row(12, 'Яблука', { batch_id: 'b', batch_size: 3, qty: '1 кг' }),
    ];
    expect(shoppingInsertDecision(batch[0]!, null)).toEqual({ kind: 'needsBatch', batchId: 'b' });
    const decisions = batch.map((r) => shoppingInsertDecision(r, [...batch].reverse()));
    expect(decisions.filter((d) => d.kind === 'batch')).toHaveLength(1);
    expect(decisions[2]).toEqual({
      kind: 'batch',
      text: '🛒 Нові товари у списку покупок (3):\n• <b>Молоко</b> — 2 л\n• <b>Хліб</b>\n• <b>Яблука</b> — 1 кг',
    });
  });

  it('партія видима не вся — ніхто не надсилає неповний список', () => {
    const seen = [row(10, 'Молоко', { batch_id: 'b', batch_size: 3 }), row(12, 'Яблука', { batch_id: 'b', batch_size: 3 })];
    expect(shoppingInsertDecision(seen[1]!, seen)).toEqual({ kind: 'wait' });
  });

  it('тиха партія мовчить цілком', () => {
    const quiet = row(12, 'Яблука', { batch_id: 'b', batch_size: 2, notify: false });
    expect(shoppingInsertDecision(quiet, null)).toEqual({ kind: 'silent' });
  });

  it('назва з «<» не ламає HTML повідомлення', () => {
    expect(escapeHtml('<script> & co')).toBe('&lt;script&gt; &amp; co');
    expect(singleShoppingText(row(1, 'a<b'))).toContain('<b>a&lt;b</b>');
    expect(batchShoppingText([row(2, 'x>y'), row(1, 'z')])).toBe('🛒 Нові товари у списку покупок (2):\n• <b>z</b>\n• <b>x&gt;y</b>');
  });

  it('«куплено» мовчить для тихого рядка й лише при переході в куплене', () => {
    const bought = { ...row(1, 'Хліб'), bought: true } as ShoppingRowLike;
    expect(boughtShoppingText(bought, { bought: false })).toBe('✅ Куплено: <b>Хліб</b>');
    expect(boughtShoppingText({ ...bought, notify: false }, { bought: false })).toBeNull();
    expect(boughtShoppingText(bought, { bought: true })).toBeNull();
    expect(boughtShoppingText(bought, null)).toBeNull();
  });
});

describe('перемикач у модулі (ADR-0262)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('типово — сповіщати; вибір пам’ятається', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    });
    expect(readShoppingNotify()).toBe(true);
    writeShoppingNotify(false);
    expect(store.get(SHOPPING_NOTIFY_KEY)).toBe('0');
    expect(readShoppingNotify()).toBe(false);
    writeShoppingNotify(true);
    expect(readShoppingNotify()).toBe(true);
  });

  it('без сховища — як досі, сповіщає', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
    expect(readShoppingNotify()).toBe(true);
    expect(() => writeShoppingNotify(false)).not.toThrow();
  });
});
