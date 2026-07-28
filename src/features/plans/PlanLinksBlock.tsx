// ============================================================
// Зв'язки плану: бажання, місця карти, спогади — і покупки.
// ------------------------------------------------------------
// «Вікенд у Карпатах» майже ніколи не сам по собі: під нього є
// бажання, мітка на карті й — після поїздки — фото в архіві. Досі
// перейти з плану до потрібного бажання можна було лише пошуком у
// чужому модулі.
//
// Покупки стоять поруч, але вони НЕ зв'язок: рядки йдуть у спільний
// список і живуть далі своїм життям. Тому й кнопка каже «Додати», а не
// «Прив'язати», і після додавання тут нічого не лишається — інакше ми
// б обіцяли двосторонність, якої в покупок немає.
// ============================================================
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { usePartner } from '@/features/_shared/useUsers';
import { CloseIcon, GiftIcon, PlusIcon } from '@/components/icons/UiIcon';
// Ті самі значки, що в нижній панелі й меню «Ще»: розділ мусить
// упізнаватись тим, чим він уже позначений в іншому місці застосунку.
import { CameraIcon, CartIcon } from '@/components/icons/NavIcon';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { useSharedWishlistItems, useWishlistItems } from '@/features/wishlist/useWishlist';
import { useMapPins } from '@/features/map/useMapPins';
import { useMemories } from '@/features/memories/useMemories';
import { formatMemoryDate } from '@/features/memories/memoriesDate';
import { useShoppingMutations } from '@/features/shopping/useShoppingItems';
import { isLinked, linksOfPlan, resolveLinks, type LinkCatalog } from './planLinkModel';
import { usePlanLinkMutations, usePlanLinks } from './usePlanLinks';
import type { PlanLinkTarget, PlanRow } from '@/types';

const TARGET_META: Record<PlanLinkTarget, {
  label: string;
  /** Куди веде тап: у планів немає власних сторінок бажання чи мітки. */
  to: string;
  Icon: typeof MapPinIcon;
}> = {
  wish: { label: 'Бажання', to: '/wishlist', Icon: GiftIcon },
  place: { label: 'Місце', to: '/map', Icon: MapPinIcon },
  memory: { label: 'Спогад', to: '/memories', Icon: CameraIcon },
};

const TABS: PlanLinkTarget[] = ['wish', 'place', 'memory'];

export function PlanLinksBlock({ plan }: { plan: PlanRow }) {
  const me = useCurrentUser();
  const partner = usePartner();
  const { data: links = [] } = usePlanLinks();
  const { link, unlink } = usePlanLinkMutations();

  const { data: myWishes = [] } = useWishlistItems(me.id);
  const { data: partnerWishes = [] } = useWishlistItems(partner?.id ?? null);
  const { data: sharedWishes = [] } = useSharedWishlistItems();
  const { data: pins = [] } = useMapPins();
  const { data: archive } = useMemories();

  const [picking, setPicking] = useState<PlanLinkTarget | null>(null);
  const [shopping, setShopping] = useState(false);

  // Довідник збирається з того, що читач і так бачить: вішлист віддає
  // лише дозволене, тож чужого сюди не потрапить (див. resolveLinks).
  const catalog = useMemo<LinkCatalog>(() => ({
    wish: new Map(
      [...myWishes, ...partnerWishes, ...sharedWishes].map((w) => [w.id, { title: w.title }]),
    ),
    place: new Map(pins.map((p) => [p.id, { title: p.title, subtitle: p.city }])),
    memory: new Map(
      (archive?.photos ?? []).map((m) => [
        m.id,
        { title: m.caption || formatMemoryDate(m.memory_date, m.date_precision) },
      ]),
    ),
  }), [myWishes, partnerWishes, sharedWishes, pins, archive]);

  const mine = linksOfPlan(plan, links);
  const resolved = resolveLinks(mine, catalog);

  // Вибір показує лише те, що ще не прив'язане: повторний рядок у
  // списку нічого не додає, а тап по ньому виглядав би як помилка.
  const options = useMemo(() => {
    if (picking === null) return [];
    const all = catalog[picking];
    if (!all) return [];
    return [...all.entries()]
      .filter(([id]) => !isLinked(plan, picking, id, links))
      .map(([id, info]) => ({ id, ...info }));
  }, [picking, catalog, plan, links]);

  return (
    <section className="plan-links">
      <header className="plan-links-head">
        <h3>Пов'язане</h3>
      </header>

      {resolved.length === 0 ? (
        <p className="plan-links-empty">
          Прив'яжи бажання, місце на карті або спогад — і план перестане бути
          самотнім рядком.
        </p>
      ) : (
        <ul className="plan-link-list">
          {resolved.map((item) => {
            const meta = TARGET_META[item.type];
            return (
              <li key={`${item.type}-${item.id}`} className="plan-link">
                <Link className="plan-link-open" to={meta.to}>
                  <span className="plan-link-icon"><meta.Icon size={17} /></span>
                  <span className="plan-link-copy">
                    <b>{item.title}</b>
                    <small>{item.subtitle ? `${meta.label} · ${item.subtitle}` : meta.label}</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="plan-link-unlink"
                  aria-label={`Відв'язати «${item.title}»`}
                  onClick={() => unlink.mutate({
                    planId: plan.id, targetType: item.type, targetId: item.id,
                  })}
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="plan-links-actions">
        {TABS.map((type) => (
          <button
            key={type}
            type="button"
            className={`plan-links-action${picking === type ? ' active' : ''}`}
            onClick={() => { setPicking(picking === type ? null : type); setShopping(false); }}
          >
            {(() => { const I = TARGET_META[type].Icon; return <I size={14} />; })()}
            {TARGET_META[type].label}
          </button>
        ))}
        <button
          type="button"
          className={`plan-links-action${shopping ? ' active' : ''}`}
          onClick={() => { setShopping((v) => !v); setPicking(null); }}
        >
          <CartIcon size={14} /> У покупки
        </button>
      </div>

      {picking !== null && (
        options.length === 0 ? (
          <p className="plan-links-empty">
            {catalog[picking]?.size
              ? 'Усе з цього розділу вже прив\'язане.'
              : 'У цьому розділі поки порожньо.'}
          </p>
        ) : (
          <ul className="plan-link-picker">
            {options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => {
                    link.mutate({ planId: plan.id, targetType: picking, targetId: opt.id });
                    setPicking(null);
                  }}
                >
                  <PlusIcon size={14} />
                  <span>{opt.title}</span>
                  {opt.subtitle && <small>{opt.subtitle}</small>}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {shopping && <ShoppingComposer plan={plan} onDone={() => setShopping(false)} />}
    </section>
  );
}

/**
 * Що купити під план.
 *
 * Свідомо однобічна дія: рядки йдуть у спільний список покупок і
 * назад не звітують. Тому текст прямо це й каже — інакше з плану
 * очікували б побачити, що вже куплено, а такого зв'язку немає.
 */
function ShoppingComposer({ plan, onDone }: { plan: PlanRow; onDone: () => void }) {
  const { add } = useShoppingMutations();
  const [text, setText] = useState('');

  const lines = text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="plan-shopping">
      <label className="form-field">
        <span>Що купити для «{plan.title}»</span>
        <textarea
          id={`plan-shopping-${plan.id}`}
          name="shopping"
          rows={3}
          value={text}
          placeholder="Термос, батарейки, сир"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <p className="plan-shopping-hint">
        Рядки підуть у спільний список покупок і житимуть там окремо від плану.
      </p>
      <div className="plan-shopping-actions">
        <button
          type="button"
          className="btn"
          disabled={lines.length === 0 || add.isPending}
          onClick={() => {
            add.mutate(
              lines.map((title) => ({ title, qty: null, category: 'Інше' as const })),
              { onSuccess: onDone },
            );
          }}
        >
          Додати {lines.length > 0 && `(${lines.length})`}
        </button>
        <button type="button" className="plan-money-cancel" onClick={onDone}>Скасувати</button>
      </div>
    </div>
  );
}
