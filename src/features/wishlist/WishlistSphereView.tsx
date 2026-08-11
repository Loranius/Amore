import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WishCard } from './WishCard';
import { buildWishSphereField, type WishSpherePlacement } from './wishSphereField';
import { useWishSphereBilliards, type WishSphereBilliards } from './useWishSphereBilliards';
import { readWishlistQuality } from './wishlistQuality';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistSpheres.css';

// ============================================================
// Sphere View — бажання як магічні скляні сфери у просторі вішліста.
// ------------------------------------------------------------
// **Вішліст має власну мову.** Сцена монарха лишається фоном, який тримає
// Amore одним світом, але поведінку модуля вона не визначає: сфери не є його
// дочірньою геометрією, не залежать від Growth Engine і не мають його
// життєвого циклу. Це presentation layer самого вішліста.
//
// **Чому DOM, а не друга сцена.** §55 забороняє окреме полотно на модуль, а
// вимога продуктивності — окремий framebuffer чи realtime refraction на кожне
// бажання. Скло, обідець, внутрішнє світіння й дрейф — усе це CSS робить
// одним композитним шаром на сферу. Ілюзія важливіша за фізичну коректність.
//
// **Доступність лишається первинною (§48).** Сфера — справжня кнопка з
// текстовою назвою: її бачить читач екрана, до неї доходить Tab, і вона ж
// відкриває той самий аркуш деталей, що й раніше. Дані, CRUD і аркуш не
// змінились — змінилось те, як бажання виглядає і як його беруть.
// ============================================================

export interface WishlistSphereViewProps {
  items: WishlistItemV3[];
  busy: boolean;
  isItemOwn: (item: WishlistItemV3) => boolean;
  canManageReservation: (item: WishlistItemV3) => boolean;
  onPhotoClick: (src: string) => void;
  onEdit: (item: WishlistItemV3) => void;
  onDelete: (id: number) => void;
  onReserve: (id: number, reserved: boolean) => void;
  onPurchased: (item: WishlistItemV3) => void;
  onFulfill: (item: WishlistItemV3) => void;
  onMove: (item: WishlistItemV3) => void;
  /** Скільки бажань не помістилось у стелю — показуємо числом, не ховаємо. */
  onShowAll?: () => void;
}

/** Вага мрії з рядка бази — саме вона вирішує розмір кулі. */
function wishPriority(value: string | null): 'high' | 'medium' | 'low' | null {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Де стоїть монарх у вікні, модуль більше не рахує.
//
// Тут жила таблиця його силуету в координатах вікна й переведення її в
// координати поля. Власник: «кристал має стати фоном, а не активним об'єктом у
// модулі вішліста» — а знання про те, де саме він стоїть, і робило вішліст
// залежним від пози камери маршруту. Фон відсувають назад приглушення й
// розмиття, не геометрія.

/** Наскільки шар зміщується від паралаксу, у пікселях на половину екрана. */
const PARALLAX_BY_LAYER: Readonly<Record<WishSpherePlacement['layer'], number>> = {
  far: 3,
  mid: 7,
  near: 12,
};

/**
 * Сфера одного бажання.
 *
 * Окремим компонентом, бо `renderTrigger` викликається під час рендера картки,
 * а стан «аркуш відкрито» треба віддати нагору ефектом — хука в тілі
 * функції-рендерера поставити нікуди.
 */
function WishSphere({
  item,
  place,
  focused,
  dimmed,
  detailsOpen,
  openDetails,
  onOpenChange,
  still,
  billiards,
}: {
  item: WishlistItemV3;
  place: WishSpherePlacement;
  focused: boolean;
  dimmed: boolean;
  detailsOpen: boolean;
  openDetails: () => void;
  onOpenChange: (id: number, open: boolean) => void;
  still: boolean;
  billiards: WishSphereBilliards;
}) {
  useEffect(() => {
    onOpenChange(item.id, detailsOpen);
  }, [item.id, detailsOpen, onOpenChange]);

  // Оброблене фото має перевагу: воно вже без фону, тобто всередині сфери
  // читається предметом, а не прямокутником із чужим тлом.
  const source = item.processed_image_url ?? item.image_url ?? null;
  // Збите фото не має лишати в кулі іконку зламаного зображення: сфера
  // повертається до зернини світла — так само, як бажання зовсім без фото.
  const [broken, setBroken] = useState(false);
  const photo = broken ? null : source;

  return (
    <button
      type="button"
      className="wl-sphere"
      data-layer={place.layer}
      data-focused={focused ? 'true' : undefined}
      data-dimmed={dimmed ? 'true' : undefined}
      data-still={still ? 'true' : undefined}
      ref={(node) => { billiards.register(item.id, node); }}
      style={{
        // Положення сюди більше не пишеться: його щокадру ставить фізика
        // (`useWishSphereBilliards`) одним рядком `transform`. Два власники
        // одного стилю затирали б одне одного.
        '--sphere-size': `${place.diameter}px`,
        '--sphere-drift-x': `${place.driftX}px`,
        '--sphere-drift-y': `${place.driftY}px`,
        '--sphere-period': `${place.period}s`,
        '--sphere-phase': `-${place.phase}s`,
      } as React.CSSProperties}
      onPointerDown={(event) => { billiards.onPointerDown(item.id, event); }}
      onClick={() => {
        // Кидок — не тап. Без цього кожен удар по кулі закінчувався б
        // відкритою карткою, і грати було б неможливо.
        if (billiards.wasThrown(item.id)) return;
        openDetails();
      }}
    >
      <span className="wl-sphere__body" aria-hidden="true">
        {photo === null ? (
          <span className="wl-sphere__seed" />
        ) : (
          <img
            className="wl-sphere__image"
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
        )}
        <span className="wl-sphere__glow" />
        <span className="wl-sphere__rim" />
      </span>
      <span className="sr-only">{item.title}</span>
    </button>
  );
}

/** Скільки триває згасання старого сузір'я перед появою нового. */
const SWAP_MS = 170;

/**
 * Перехід між наборами бажань замість різкого перемальовування (§17).
 *
 * Вкладка змінилась — старі сфери згасають, і аж тоді з'являються нові. Фон
 * монарха при цьому не рушить: саме контраст між сталим світом і змінним
 * вмістом і робить Amore одним місцем.
 *
 * Правка того самого бажання (нове фото, нова назва) проходить одразу: набір
 * той самий, гасити нічого.
 */
function useSwappedItems(items: WishlistItemV3[], instant: boolean): {
  shown: WishlistItemV3[];
  phase: 'in' | 'out';
} {
  const signature = items.map((item) => item.id).join(',');
  const [state, setState] = useState({ items, signature, phase: 'in' as 'in' | 'out' });
  const latest = useRef(items);
  latest.current = items;

  useEffect(() => {
    if (state.signature === signature) {
      // Ті самі бажання, інші дані — оновлюємо без переходу.
      if (state.items !== items) setState((current) => ({ ...current, items }));
      return;
    }
    if (instant) {
      setState({ items, signature, phase: 'in' });
      return;
    }
    setState((current) => ({ ...current, phase: 'out' }));
    const timer = window.setTimeout(() => {
      setState({ items: latest.current, signature, phase: 'in' });
    }, SWAP_MS);
    return () => { window.clearTimeout(timer); };
  }, [signature, items, instant, state.signature, state.items]);

  return { shown: state.items, phase: state.phase };
}

export function WishlistSphereView({ items, onShowAll, ...card }: WishlistSphereViewProps) {
  const field = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [focused, setFocused] = useState<number | null>(null);
  const [quality] = useState(readWishlistQuality);
  const [still] = useState(prefersReducedMotion);
  const { shown, phase } = useSwappedItems(items, still);

  // Поле міряється, а не вгадується: сузір'я розкладається в пікселях, і
  // розмір сфери заданий часткою меншого боку.
  useLayoutEffect(() => {
    const node = field.current;
    if (node === null) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      setSize((current) => (
        Math.abs(current.width - box.width) < 1 && Math.abs(current.height - box.height) < 1
          ? current
          : { width: box.width, height: box.height }
      ));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  const places = useMemo(() => {
    if (size.width === 0 || size.height === 0) return [];
    return buildWishSphereField({
      subjects: shown.map((item) => ({ id: item.id, priority: wishPriority(item.priority) })),
      field: size,
      quality,
    });
  }, [shown, size, quality]);

  const placeById = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
  );

  // Інерція, зіткнення й перетягування. Власник попросив повернути те, що було
  // в бульбашок: кулю можна штовхнути, і вона поводиться як куля.
  const billiards = useWishSphereBilliards({
    places,
    size,
    still,
    parallaxByLayer: PARALLAX_BY_LAYER,
  });

  const onOpenChange = useCallback((id: number, open: boolean) => {
    setFocused((current) => (open ? id : current === id ? null : current));
  }, []);

  const hidden = Math.max(0, shown.length - places.length);

  return (
    <div
      className="wl-sphere-field"
      ref={field}
      data-quality={quality}
      data-phase={phase}
      data-ready={places.length > 0 ? 'true' : undefined}
    >
      {shown.map((item) => {
        const place = placeById.get(item.id);
        if (place === undefined) return null;
        return (
          <WishCard
            key={item.id}
            item={item}
            isOwn={card.isItemOwn(item)}
            canManageReservation={card.canManageReservation(item)}
            busy={card.busy}
            onPhotoClick={card.onPhotoClick}
            onEdit={card.onEdit}
            onDelete={card.onDelete}
            onReserve={card.onReserve}
            onPurchased={card.onPurchased}
            onFulfill={card.onFulfill}
            onMove={card.onMove}
            renderTrigger={({ openDetails, detailsOpen }) => (
              <WishSphere
                item={item}
                place={place}
                focused={focused === item.id}
                dimmed={focused !== null && focused !== item.id}
                detailsOpen={detailsOpen}
                openDetails={openDetails}
                onOpenChange={onOpenChange}
                still={still}
                billiards={billiards}
              />
            )}
          />
        );
      })}

      {hidden > 0 && (
        // Стеля є, але мовчазної втрати немає: решта названа числом і має
        // шлях — той самий перемикач вигляду, що вже живе в аркуші.
        <button type="button" className="wl-sphere-more" onClick={onShowAll}>
          +{hidden} у списку
        </button>
      )}
    </div>
  );
}
