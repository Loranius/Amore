// ============================================================
// ShoppingPage — вкладка «Покупки» (порт shopping.js UI)
// ------------------------------------------------------------
// Активний список групується за категоріями в порядку
// SHOPPING_CATEGORIES; куплене — у згортному архіві. Додавання,
// тогл, видалення й редагування — через useShoppingMutations
// (оптимістично). Жодного document.getElementById / innerHTML.
// ============================================================
import { useMemo, useState } from 'react';
import { SHOPPING_CATEGORIES } from '@/app/constants';
import { useUsersMap } from '@/features/_shared/useUsers';
import {
  useShoppingItems,
  useShoppingMutations,
  parseShoppingInput,
} from './useShoppingItems';
import { EditItemModal } from './EditItemModal';
import { PortalDecor } from '@/features/auth/PortalDecor';
import type { ShoppingItemRow, ShoppingCategory } from '@/types';

export function ShoppingPage() {
  const { data: items = [], isPending, isError } = useShoppingItems();
  const { add, toggleBought, remove, edit } = useShoppingMutations();
  const usersMap = useUsersMap();
  const authorName = (id: number | null) => (id !== null && usersMap[id]) || 'Хтось';

  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItemRow | null>(null);

  const active = items.filter((i) => !i.bought);
  const bought = useMemo(
    () =>
      items
        .filter((i) => i.bought)
        .sort(
          (a, b) =>
            new Date(b.bought_at ?? 0).getTime() - new Date(a.bought_at ?? 0).getTime(),
        ),
    [items],
  );

  // Групування активних за категорією у фіксованому порядку (+ невідомі в кінці).
  const grouped = useMemo(() => {
    const byCat = new Map<string, ShoppingItemRow[]>();
    for (const i of active) {
      const cat = i.category || 'Інше';
      const arr = byCat.get(cat) ?? [];
      arr.push(i);
      byCat.set(cat, arr);
    }
    const extra = [...byCat.keys()].filter(
      (c) => !SHOPPING_CATEGORIES.includes(c as ShoppingCategory),
    );
    const order = [...SHOPPING_CATEGORIES, ...extra];
    return order
      .map((cat) => ({ cat, rows: byCat.get(cat) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [active]);

  const submitAdd = async () => {
    if (!input.trim() || adding) return;
    setAdding(true);
    try {
      const lines = await parseShoppingInput(input);
      if (lines.length) {
        add.mutate(lines);
        setInput('');
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="shopping pink-page">
      <PortalDecor density="light" parallax={false} />
      <h1>Покупки</h1>

      {/* Введення */}
      <div className="sl-input-row">
        <input
          id="shopping-input"
          name="input"
          type="text"
          className="sl-input"
          placeholder="Молоко, хліб, 2 яблука…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submitAdd();
            }
          }}
        />
        <button
          type="button"
          className="sl-add-btn"
          onClick={() => void submitAdd()}
          disabled={adding || !input.trim()}
          aria-label="Додати"
        >
          {adding ? '…' : '+'}
        </button>
      </div>

      {/* Активний список */}
      {isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : isError ? (
        <p className="empty-state">Не вдалось завантажити список.</p>
      ) : active.length === 0 ? (
        <p className="empty-state">Список порожній. Додай перший товар вище.</p>
      ) : (
        grouped.map(({ cat, rows }) => (
          <div key={cat} className="sl-group">
            <div className="sl-group-head">
              <span>{cat}</span>
              <span className="sl-group-count">{rows.length}</span>
            </div>
            <div className="sl-group-body">
              {rows.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  authorName={authorName}
                  onToggle={() => toggleBought.mutate(i)}
                  onDelete={() => remove.mutate(i.id)}
                  onEdit={() => setEditing(i)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Архів куплених */}
      <div className="sl-archive">
        <button
          type="button"
          className="sl-archive-toggle"
          onClick={() => setArchiveOpen((v) => !v)}
          aria-expanded={archiveOpen}
        >
          <span className={`sl-archive-arrow${archiveOpen ? ' open' : ''}`} aria-hidden="true">
            ›
          </span>
          Куплено <span className="sl-archive-count">{bought.length}</span>
        </button>

        {archiveOpen && (
          <div className="sl-archive-body">
            {bought.length === 0 ? (
              <p className="empty-state">Поки нічого не куплено.</p>
            ) : (
              bought.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  bought
                  authorName={authorName}
                  onToggle={() => toggleBought.mutate(i)}
                  onDelete={() => remove.mutate(i.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {editing && (
        <EditItemModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => edit.mutate(patch)}
        />
      )}
    </section>
  );
}

// ── Рядок товару ─────────────────────────────────────────────
interface ItemRowProps {
  item: ShoppingItemRow;
  bought?: boolean;
  authorName: (id: number | null) => string;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

function ItemRow({ item, bought = false, authorName, onToggle, onDelete, onEdit }: ItemRowProps) {
  return (
    <div className={`sl-item-row${bought ? ' sl-item-row-bought' : ''}`}>
      <button
        type="button"
        className={`sl-check${bought ? ' sl-check-on' : ''}`}
        onClick={onToggle}
        aria-label={bought ? 'Повернути в список' : 'Куплено'}
      >
        {bought ? '✓' : ''}
      </button>

      <div className="sl-item-info">
        <span className="sl-item-title">{item.title}</span>
        {item.qty && <span className="sl-item-qty">{item.qty}</span>}
        <span className="sl-item-author">
          {bought
            ? `купив(ла) ${authorName(item.bought_by)}`
            : `від ${authorName(item.created_by)}`}
        </span>
      </div>

      {onEdit && (
        <button type="button" className="sl-edit-btn" onClick={onEdit} aria-label="Редагувати">
          ✏️
        </button>
      )}
      <button type="button" className="sl-del-btn" onClick={onDelete} aria-label="Видалити">
        ×
      </button>
    </div>
  );
}
