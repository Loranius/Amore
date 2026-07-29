// ============================================================
// ShoppingPage — щоденний спільний список покупок.
// ------------------------------------------------------------
// Логіка лишається простою: довільний ввід розбирається на товари й
// категорії, активне групується, куплене ховається в компактний архів.
// Цей компонент відповідає лише за людяну мобільну подачу.
// ============================================================
import { useMemo, useState, type CSSProperties } from 'react';
import { SHOPPING_CATEGORIES } from '@/app/constants';
import {
  BagIcon,
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  RefreshIcon,
  TrashIcon,
} from '@/components/icons/UiIcon';
import { PortalDecor } from '@/features/auth/PortalDecor';
import { useUsersMap } from '@/features/_shared/useUsers';
import {
  useShoppingItems,
  useShoppingMutations,
  parseShoppingInput,
} from './useShoppingItems';
import { EditItemModal } from './EditItemModal';
import './shopping.css';
import type { ShoppingItemRow, ShoppingCategory } from '@/types';

const CATEGORY_VISUALS: Record<string, { icon: string; color: string }> = {
  Овочі: { icon: '🥦', color: '#65a978' },
  Фрукти: { icon: '🍎', color: '#d96f78' },
  "М'ясо": { icon: '🥩', color: '#b96a68' },
  Морепродукти: { icon: '🐟', color: '#6299b5' },
  Напої: { icon: '🥤', color: '#7b8ec1' },
  Побут: { icon: '🧽', color: '#c69754' },
  Посуд: { icon: '🍽️', color: '#9481a9' },
  Гігієна: { icon: '🧴', color: '#5fa8a0' },
  Косметика: { icon: '✨', color: '#c774a2' },
  Канцелярія: { icon: '✏️', color: '#c48d4e' },
  Спорт: { icon: '🏃', color: '#7394b0' },
  Інше: { icon: '🛍️', color: '#9a7d8a' },
};

function categoryVisual(category: string) {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS['Інше']!;
}

export function ShoppingPage() {
  const {
    data: items = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useShoppingItems();
  const { add, toggleBought, remove, edit } = useShoppingMutations();
  const usersMap = useUsersMap();
  const authorName = (id: number | null) => (id !== null && usersMap[id]) || 'Хтось';

  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItemRow | null>(null);

  const active = useMemo(() => items.filter((item) => !item.bought), [items]);
  const bought = useMemo(
    () =>
      items
        .filter((item) => item.bought)
        .sort(
          (a, b) =>
            new Date(b.bought_at ?? 0).getTime() - new Date(a.bought_at ?? 0).getTime(),
        ),
    [items],
  );

  // Фіксований порядок від Edge Function + невідомі легасі-категорії в кінці.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, ShoppingItemRow[]>();
    for (const item of active) {
      const category = item.category || 'Інше';
      const rows = byCategory.get(category) ?? [];
      rows.push(item);
      byCategory.set(category, rows);
    }
    const extra = [...byCategory.keys()].filter(
      (category) => !SHOPPING_CATEGORIES.includes(category as ShoppingCategory),
    );
    const order = [...SHOPPING_CATEGORIES, ...extra];
    return order
      .map((category) => ({ category, rows: byCategory.get(category) ?? [] }))
      .filter((group) => group.rows.length > 0);
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

  const statusText = active.length === 0
    ? 'На сьогодні все куплено'
    : `${active.length} ${active.length === 1 ? 'покупка' : active.length < 5 ? 'покупки' : 'покупок'} залишилось`;

  return (
    <section className="shopping shopping-page pink-page">
      <PortalDecor density="light" parallax={false} />

      <header className="shopping-hero">
        <span className="shopping-hero-icon" aria-hidden="true"><BagIcon size={28} /></span>
        <div className="shopping-hero-copy">
          <span className="shopping-eyebrow">Спільний список</span>
          <h1>Покупки</h1>
          <p>{statusText}</p>
        </div>
        {active.length > 0 && (
          <span className="shopping-hero-count" aria-label={statusText}>{active.length}</span>
        )}
      </header>

      <section className="shopping-composer" aria-labelledby="shopping-composer-title">
        <div className="shopping-composer-copy">
          <h2 id="shopping-composer-title">Що потрібно купити?</h2>
          <p>Можна вписати кілька товарів через кому — вони самі розкладуться за категоріями.</p>
        </div>
        <div className="shopping-composer-row">
          <textarea
            id="shopping-input"
            name="input"
            className="shopping-input"
            rows={2}
            placeholder="Молоко, хліб, 2 яблука…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitAdd();
              }
            }}
            disabled={adding}
          />
          <button
            type="button"
            className="shopping-add-button"
            onClick={() => void submitAdd()}
            disabled={adding || !input.trim()}
          >
            <span aria-hidden="true">{adding ? '•••' : '+'}</span>
            <strong>{adding ? 'Сортую' : 'Додати'}</strong>
          </button>
        </div>
      </section>

      {isPending ? (
        <ShoppingSkeleton />
      ) : isError ? (
        <section className="shopping-state shopping-state--error" role="alert">
          <span aria-hidden="true">!</span>
          <h2>Список не завантажився</h2>
          <p>Перевірте з’єднання та спробуйте ще раз.</p>
          <button type="button" className="btn" disabled={isFetching} onClick={() => void refetch()}>
            <RefreshIcon size={17} />
            {isFetching ? 'Оновлюю…' : 'Спробувати ще'}
          </button>
        </section>
      ) : active.length === 0 ? (
        <section className="shopping-state shopping-state--empty">
          <span aria-hidden="true"><CheckIcon size={30} /></span>
          <h2>Список чистий</h2>
          <p>Додайте наступну покупку у поле вище.</p>
        </section>
      ) : (
        <div className="shopping-groups" aria-label="Потрібно купити">
          {grouped.map(({ category, rows }) => {
            const visual = categoryVisual(category);
            const style = { '--shopping-category': visual.color } as CSSProperties;
            return (
              <section key={category} className="shopping-group" style={style}>
                <header className="shopping-group-head">
                  <span className="shopping-group-icon" aria-hidden="true">{visual.icon}</span>
                  <h2>{category}</h2>
                  <span className="shopping-group-count">{rows.length}</span>
                </header>
                <div className="shopping-group-list">
                  {rows.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      authorName={authorName}
                      onToggle={() => toggleBought.mutate(item)}
                      onDelete={() => remove.mutate(item.id)}
                      onEdit={() => setEditing(item)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <details
        className="shopping-archive"
        open={archiveOpen}
        onToggle={(event) => setArchiveOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="shopping-archive-copy">
            <small>Не заважають поточному списку</small>
            <strong>Куплено</strong>
          </span>
          <span className="shopping-archive-tail">
            <b>{bought.length}</b>
            <ChevronDownIcon size={18} />
          </span>
        </summary>

        {archiveOpen && (
          <div className="shopping-archive-list">
            {bought.length === 0 ? (
              <p className="shopping-archive-empty">Поки нічого не куплено.</p>
            ) : (
              bought.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  bought
                  authorName={authorName}
                  onToggle={() => toggleBought.mutate(item)}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))
            )}
          </div>
        )}
      </details>

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
    <article className={`shopping-item${bought ? ' shopping-item--bought' : ''}`}>
      <button
        type="button"
        className={`shopping-check${bought ? ' shopping-check--on' : ''}`}
        onClick={onToggle}
        aria-label={bought ? 'Повернути в список' : 'Позначити купленим'}
      >
        {bought && <CheckIcon size={17} />}
      </button>

      <div className="shopping-item-info">
        <div className="shopping-item-main">
          <strong>{item.title}</strong>
          {item.qty && <span>{item.qty}</span>}
        </div>
        <small>
          {bought
            ? `Купив(ла) ${authorName(item.bought_by)}`
            : `Додав(ла) ${authorName(item.created_by)}`}
        </small>
      </div>

      <div className="shopping-item-actions">
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Редагувати «${item.title}»`}>
            <PencilIcon size={17} />
          </button>
        )}
        <button type="button" className="shopping-delete" onClick={onDelete} aria-label={`Видалити «${item.title}»`}>
          <TrashIcon size={17} />
        </button>
      </div>
    </article>
  );
}

function ShoppingSkeleton() {
  return (
    <div className="shopping-skeleton" aria-hidden="true">
      <span className="shopping-skeleton-heading" />
      <span />
      <span />
      <span className="shopping-skeleton-heading" />
      <span />
      <span />
    </div>
  );
}
