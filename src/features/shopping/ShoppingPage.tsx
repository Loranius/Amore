// ============================================================
// ShoppingPage — щоденний спільний список покупок.
// ------------------------------------------------------------
// Логіка лишається простою: довільний ввід розбирається на товари й
// категорії, активне групується, куплене ховається в компактний архів.
// Цей компонент відповідає лише за людяну мобільну подачу.
//
// Третій модуль, який впускає світ. Власник: «модуль покупки… кристал на фоні
// також розмитий і обертається на 45 градусів зліва на право і продовжує
// повільно обертатись на фоні». Три хуки нижче — це весь механізм: маршрут
// каже атласу, де стати камері (`provision` — дзеркало планів), а приглушення
// відсуває сцену за модуль.
//
// РОЗКЛАДКА, як її описав власник: «зверху є шапка з найменуванням модуля —
// його прибираємо. Поле вводу покупок переносимо в нижню частину модуля. Також
// під полем додай кнопку шаблон».
//
// Звідси три речі, які варто пояснити один раз:
//
// - Шапки немає взагалі. Назву модуля вже каже док, а панель на 118 px
//   забирала верх екрана в списку, заради якого сюди й заходять.
// - Ввід стоїть унизу й лишається на місці при прокруті (`.shopping-dock`).
//   Це не оздоблення: списком користуються в магазині однією рукою, і поле,
//   яке треба догортати, — це поле, яким не користуються.
// - Полиця шаблона відкривається НАД полем, хоч кнопка стоїть під ним. Інакше
//   вона розкривалась би вниз, за нижній край екрана.
// ============================================================
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { SHOPPING_CATEGORIES } from '@/app/constants';
import {
  BagIcon,
  BoxIcon,
  CheckIcon,
  ChevronDownIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  StarIcon,
  TrashIcon,
} from '@/components/icons/UiIcon';
import { useUsersMap } from '@/features/_shared/useUsers';
import {
  useShoppingItems,
  useShoppingMutations,
  parseShoppingInput,
} from './useShoppingItems';
import { EditItemModal } from './EditItemModal';
import {
  TEMPLATE_GROUPS,
  listedKeys,
  templateKey,
  type TemplateGroup,
  type TemplateItem,
} from './shoppingTemplates';
import { useWorldVisibleRoute } from '@/features/world/useWorldVisibleRoute';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import { useDimmedWorld } from '@/features/world/worldDim';
import '@/features/world/worldDim.css';
import './shopping.css';
import './shoppingCompact.css';
import './shoppingWorld.css';
import type { ShoppingItemRow, ShoppingCategory } from '@/types';

/**
 * Значок полиці шаблона.
 *
 * Іконки, не емодзі: власник обрав це ще в чорновику модуля. Категорії
 * списку нижче поки лишились емодзі — їхня заміна потребує дванадцяти нових
 * значків і чекає на свій захід (ADR-0032).
 */
const TEMPLATE_GROUP_ICONS: Record<TemplateGroup['id'], ReactNode> = {
  food: <BagIcon size={15} />,
  home: <BoxIcon size={15} />,
  treats: <StarIcon size={15} />,
};

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

const COMPLETE_ANIMATION_MS = 430;

function categoryVisual(category: string) {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS['Інше']!;
}

export function ShoppingPage() {
  // Світ позаду, як у вішліста й планів: сцена лишається фоном, дотики —
  // сторінці.
  const { webglSupported } = useArtifactWorld();
  useWorldVisibleRoute();
  useDimmedWorld(webglSupported);

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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItemRow | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<number>>(() => new Set());
  const completionTimers = useRef(new Map<number, number>());

  useEffect(() => () => {
    completionTimers.current.forEach((timer) => window.clearTimeout(timer));
    completionTimers.current.clear();
  }, []);

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

  const toggleItem = (item: ShoppingItemRow) => {
    if (item.bought) {
      toggleBought.mutate(item);
      return;
    }
    if (completionTimers.current.has(item.id)) return;

    setCompletingIds((current) => {
      const next = new Set(current);
      next.add(item.id);
      return next;
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      completionTimers.current.delete(item.id);
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      toggleBought.mutate(item);
    }, reduceMotion ? 40 : COMPLETE_ANIMATION_MS);

    completionTimers.current.set(item.id, timer);
  };

  // Що вже лежить в активному списку — щоб полиця не давала додати друге
  // молоко мовчки. Порівняння по канонічному ключу: «молоко» з поля вводу і
  // «Молоко» з полиці — та сама покупка.
  const listed = useMemo(() => listedKeys(active.map((item) => item.title)), [active]);

  const addFromTemplate = (item: TemplateItem) => {
    if (listed.has(templateKey(item.title))) return;
    add.mutate([{ title: item.title, qty: null, category: item.category }]);
  };

  return (
    <section className="shopping shopping-page" data-world={webglSupported ? 'true' : undefined}>

      <div className="shopping-body">
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
          <p>Додайте наступну покупку в поле внизу — або візьміть готове з шаблону.</p>
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
                      completing={completingIds.has(item.id)}
                      authorName={authorName}
                      onToggle={() => toggleItem(item)}
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
                  onToggle={() => toggleItem(item)}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))
            )}
          </div>
        )}
      </details>
      </div>

      {/* Нижня частина модуля: полиця шаблона, поле вводу, кнопка шаблона.
          Полиця стоїть ПЕРЕД полем у розмітці навмисно — док притиснутий до
          низу, тож усе, що після кнопки, розкривалось би за край екрана. */}
      <div className="shopping-dock">
        {templateOpen && (
          <TemplateShelf
            listed={listed}
            onPick={addFromTemplate}
            onClose={() => setTemplateOpen(false)}
          />
        )}

        <div className="shopping-composer-row">
          <textarea
            id="shopping-input"
            name="input"
            className="shopping-input"
            rows={1}
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
            <span aria-hidden="true">{adding ? <DotsGlyph /> : <PlusIcon size={20} />}</span>
            <strong>{adding ? 'Сортую' : 'Додати'}</strong>
          </button>
        </div>

        <button
          type="button"
          className={`shopping-template-toggle${templateOpen ? ' shopping-template-toggle--open' : ''}`}
          onClick={() => setTemplateOpen((open) => !open)}
          aria-expanded={templateOpen}
          aria-controls="shopping-template-shelf"
        >
          <LayersIcon size={16} />
          <strong>Шаблон</strong>
          <ChevronDownIcon size={16} />
        </button>
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

/** Три крапки очікування — тим самим значком, що й решта кнопки. */
function DotsGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="16" cy="10" r="1.6" />
    </svg>
  );
}

interface TemplateShelfProps {
  listed: ReadonlySet<string>;
  onPick: (item: TemplateItem) => void;
  onClose: () => void;
}

/**
 * Полиця шаблона — базові товари, вже розкладені по полицях.
 *
 * Розкладка задана даними, а не розміткою: власник просив, щоб «вся продукція
 * там вже розсортована по категоріям», і саме `TEMPLATE_GROUPS` каже, що де
 * лежить. Компонент їх лише малює.
 *
 * Дотик по товару додає його одразу — жодного проміжного кроку, як і просив
 * власник. Товар, який уже в списку, підписаний і не реагує: додати друге
 * молоко можна полем вводу, але не мовчазним повторним дотиком.
 */
function TemplateShelf({ listed, onPick, onClose }: TemplateShelfProps) {
  return (
    <section className="shopping-shelf" id="shopping-template-shelf" aria-label="Шаблон покупок">
      <header className="shopping-shelf-head">
        <strong>Базові покупки</strong>
        <button type="button" onClick={onClose} aria-label="Згорнути шаблон">
          <ChevronDownIcon size={16} />
        </button>
      </header>

      <div className="shopping-shelf-scroll">
        {TEMPLATE_GROUPS.map((group) => (
          <section key={group.id} className="shopping-shelf-group">
            <h3>
              <span aria-hidden="true">{TEMPLATE_GROUP_ICONS[group.id]}</span>
              {group.title}
            </h3>
            <div className="shopping-shelf-items">
              {group.items.map((item) => {
                const already = listed.has(templateKey(item.title));
                return (
                  <button
                    key={item.title}
                    type="button"
                    className={`shopping-shelf-item${already ? ' shopping-shelf-item--listed' : ''}`}
                    onClick={() => onPick(item)}
                    disabled={already}
                    aria-label={already ? `${item.title} — уже в списку` : `Додати ${item.title}`}
                  >
                    <span aria-hidden="true">
                      {already ? <CheckIcon size={13} /> : <PlusIcon size={13} />}
                    </span>
                    {item.title}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

interface ItemRowProps {
  item: ShoppingItemRow;
  bought?: boolean;
  completing?: boolean;
  authorName: (id: number | null) => string;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

function ItemRow({
  item,
  bought = false,
  completing = false,
  authorName,
  onToggle,
  onDelete,
  onEdit,
}: ItemRowProps) {
  const locked = completing;
  return (
    <article
      className={`shopping-item${bought ? ' shopping-item--bought' : ''}${completing ? ' shopping-item--completing' : ''}`}
      aria-busy={completing || undefined}
    >
      <button
        type="button"
        className={`shopping-check${bought || completing ? ' shopping-check--on' : ''}${completing ? ' shopping-check--pending' : ''}`}
        onClick={onToggle}
        disabled={locked}
        aria-label={bought ? 'Повернути в список' : completing ? 'Переношу в куплене' : 'Позначити купленим'}
      >
        {(bought || completing) && <CheckIcon size={16} />}
      </button>

      <div className="shopping-item-info">
        <div className="shopping-item-main">
          <strong>{item.title}</strong>
          {item.qty && <span>{item.qty}</span>}
        </div>
        {bought && <small>Купив(ла) {authorName(item.bought_by)}</small>}
      </div>

      <div className="shopping-item-actions">
        {onEdit && (
          <button type="button" onClick={onEdit} disabled={locked} aria-label={`Редагувати «${item.title}»`}>
            <PencilIcon size={15} />
          </button>
        )}
        <button
          type="button"
          className="shopping-delete"
          onClick={onDelete}
          disabled={locked}
          aria-label={`Видалити «${item.title}»`}
        >
          <TrashIcon size={15} />
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
