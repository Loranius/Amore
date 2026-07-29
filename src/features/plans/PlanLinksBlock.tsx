// ============================================================
// Зв'язки плану: бажання, місця карти, спогади — і покупки.
// ------------------------------------------------------------
// Важкі каталоги не завантажуються, доки згорнута секція не з'явиться у
// viewport. Це прибирає запити до вішлиста, карти й архіву при звичайному
// відкритті сторінки плану.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { usePartner } from '@/features/_shared/useUsers';
import { CloseIcon, GiftIcon, PlusIcon } from '@/components/icons/UiIcon';
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
import './planLinksTiles.css';

const TARGET_META: Record<PlanLinkTarget, {
  label: string;
  description: string;
  to: string;
  Icon: typeof MapPinIcon;
}> = {
  wish: {
    label: 'Бажання',
    description: 'Пов’язати зі спільною або особистою мрією',
    to: '/wishlist',
    Icon: GiftIcon,
  },
  place: {
    label: 'Місце',
    description: 'Додати точку з вашої карти',
    to: '/map',
    Icon: MapPinIcon,
  },
  memory: {
    label: 'Спогад',
    description: 'Прикріпити фото або вже прожитий момент',
    to: '/memories',
    Icon: CameraIcon,
  },
};

const TABS: PlanLinkTarget[] = ['wish', 'place', 'memory'];

export function PlanLinksBlock({ plan, embedded = false }: {
  plan: PlanRow;
  embedded?: boolean;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(!embedded);

  useEffect(() => {
    if (active || !embedded) return;
    const node = rootRef.current;
    if (!node) return;

    if (!('IntersectionObserver' in window)) {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, embedded]);

  return (
    <section ref={rootRef} className={`plan-links${embedded ? ' plan-links--embedded' : ''}`}>
      {active ? (
        <PlanLinksContent plan={plan} embedded={embedded} />
      ) : (
        <div className="plan-links-deferred" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
    </section>
  );
}

function PlanLinksContent({ plan, embedded }: { plan: PlanRow; embedded: boolean }) {
  const me = useCurrentUser();
  const partner = usePartner();
  const { data: links = [] } = usePlanLinks();
  const { link, unlink } = usePlanLinkMutations();

  const { data: myWishes = [] } = useWishlistItems(me.id);
  const { data: partnerWishes = [] } = useWishlistItems(partner?.id ?? null);
  const { data: sharedWishes = [] } = useSharedWishlistItems();
  const { data: pins = [] } = useMapPins();
  const { data: archive } = useMemories();

  const [choosing, setChoosing] = useState(false);
  const [picking, setPicking] = useState<PlanLinkTarget | null>(null);
  const [shopping, setShopping] = useState(false);

  const catalog = useMemo<LinkCatalog>(() => ({
    wish: new Map(
      [...myWishes, ...partnerWishes, ...sharedWishes].map((wish) => [
        wish.id,
        {
          title: wish.title,
          subtitle: wish.description,
          imageUrl: wish.image_url,
        },
      ]),
    ),
    place: new Map(pins.map((pin) => [
      pin.id,
      {
        title: pin.title,
        subtitle: [pin.city, pin.country].filter(Boolean).join(' · ') || null,
        imageUrl: pin.photo_url,
      },
    ])),
    memory: new Map(
      (archive?.photos ?? []).map((memory) => {
        const date = formatMemoryDate(memory.memory_date, memory.date_precision);
        return [
          memory.id,
          {
            title: memory.caption || date,
            subtitle: memory.caption ? date : null,
            imageUrl: memory.photo_url,
          },
        ];
      }),
    ),
  }), [myWishes, partnerWishes, sharedWishes, pins, archive]);

  const mine = linksOfPlan(plan, links);
  const resolved = resolveLinks(mine, catalog);

  const options = useMemo(() => {
    if (picking === null) return [];
    const all = catalog[picking];
    if (!all) return [];
    return [...all.entries()]
      .filter(([id]) => !isLinked(plan, picking, id, links))
      .map(([id, info]) => ({ id, ...info }));
  }, [picking, catalog, plan, links]);

  const startPicking = (type: PlanLinkTarget) => {
    setChoosing(false);
    setShopping(false);
    setPicking(type);
  };

  return (
    <>
      {!embedded && (
        <header className="plan-links-head"><h3>Пов'язане</h3></header>
      )}

      {resolved.length === 0 ? (
        <p className="plan-links-empty">Тут можна зібрати все, що стосується цього плану.</p>
      ) : (
        <ul className="plan-link-grid">
          {resolved.map((item) => {
            const meta = TARGET_META[item.type];
            return (
              <li key={`${item.type}-${item.id}`} className="plan-link-card">
                <Link
                  className="plan-link-open"
                  to={meta.to}
                  aria-label={`Відкрити ${meta.label.toLowerCase()} «${item.title}»`}
                >
                  <LinkPreviewMedia imageUrl={item.imageUrl} Icon={meta.Icon} />
                  <span className="plan-link-shade" aria-hidden="true" />
                  <span className="plan-link-type"><meta.Icon size={13} /> {meta.label}</span>
                  <span className="plan-link-copy">
                    <b>{item.title}</b>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </span>
                </Link>
                <button
                  type="button"
                  className="plan-link-unlink"
                  aria-label={`Відв'язати «${item.title}»`}
                  onClick={() => unlink.mutate({
                    planId: plan.id,
                    targetType: item.type,
                    targetId: item.id,
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
        <button
          type="button"
          className={`plan-links-action plan-links-action--primary${choosing ? ' active' : ''}`}
          onClick={() => {
            setChoosing((value) => !value);
            setPicking(null);
            setShopping(false);
          }}
        >
          <PlusIcon size={15} /> Додати пов’язане
        </button>
      </div>

      {choosing && (
        <div className="plan-link-kind-picker" role="group" aria-label="Що додати до плану">
          {TABS.map((type) => {
            const meta = TARGET_META[type];
            return (
              <button key={type} type="button" onClick={() => startPicking(type)}>
                <span className="plan-link-kind-icon"><meta.Icon size={20} /></span>
                <span><b>{meta.label}</b><small>{meta.description}</small></span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setChoosing(false);
              setPicking(null);
              setShopping(true);
            }}
          >
            <span className="plan-link-kind-icon"><CartIcon size={20} /></span>
            <span><b>У покупки</b><small>Додати потрібні речі до спільного списку</small></span>
          </button>
        </div>
      )}

      {picking !== null && (
        options.length === 0 ? (
          <p className="plan-links-empty">
            {catalog[picking]?.size ? 'Усе з цього розділу вже пов’язане.' : 'У цьому розділі поки порожньо.'}
          </p>
        ) : (
          <ul className="plan-link-picker">
            {options.map((option) => {
              const meta = TARGET_META[picking];
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-label={`Додати «${option.title}»`}
                    onClick={() => {
                      link.mutate({ planId: plan.id, targetType: picking, targetId: option.id });
                      setPicking(null);
                    }}
                  >
                    <LinkPreviewMedia imageUrl={option.imageUrl} Icon={meta.Icon} />
                    <span className="plan-link-picker-shade" aria-hidden="true" />
                    <span className="plan-link-picker-add"><PlusIcon size={14} /></span>
                    <span className="plan-link-picker-copy">
                      <b>{option.title}</b>
                      {option.subtitle && <small>{option.subtitle}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      {shopping && <ShoppingComposer plan={plan} onDone={() => setShopping(false)} />}
    </>
  );
}

function LinkPreviewMedia({ imageUrl, Icon }: {
  imageUrl: string | null | undefined;
  Icon: typeof MapPinIcon;
}) {
  return (
    <span className="plan-link-media" aria-hidden="true">
      <span className="plan-link-media-fallback"><Icon size={30} /></span>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      )}
    </span>
  );
}

function ShoppingComposer({ plan, onDone }: { plan: PlanRow; onDone: () => void }) {
  const { add } = useShoppingMutations();
  const [text, setText] = useState('');
  const lines = text.split(/[,\n]/).map((line) => line.trim()).filter(Boolean);

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
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <p className="plan-shopping-hint">Рядки підуть у спільний список покупок і житимуть там окремо від плану.</p>
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
