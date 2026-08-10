import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { resolveCrystalRendererQuality } from '@/engine/renderer';
import { WishCard } from './WishCard';
import {
  buildWishSphereField,
  type WishSphereKeepOut,
  type WishSphereQuality,
  type WishSpherePlacement,
} from './wishSphereField';
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

/**
 * Профіль пристрою для сфер.
 *
 * Той самий, за яким живе решта світу (`resolveCrystalRendererQuality`), і це
 * не збіг: §19 просить інтегруватись у наявну систему якості, а не заводити
 * другу відповідь на те саме питання про пристрій.
 */
function readQuality(): WishSphereQuality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'low';
  const extended = navigator as Navigator & { deviceMemory?: number };
  return resolveCrystalRendererQuality({
    webgl: true,
    webgl2: typeof WebGL2RenderingContext !== 'undefined',
    deviceMemoryGb: typeof extended.deviceMemory === 'number' ? extended.deviceMemory : null,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null,
    devicePixelRatio: window.devicePixelRatio,
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Паралакс — лише там, де є справжній курсор: на телефоні його нічим вести. */
function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: fine)').matches;
}

/**
 * Де стоїть монарх у вікні — виміряно на живому порталі.
 *
 * Не здогадка й не константа сцени: поза вішліста фіксована (камера приходить
 * у неї й лишається), тож силует займає те саме місце кадру щоразу. Числа
 * зняті зі знімка вертикального телефона — вісь трохи правіше центру, вершина
 * близько 42% висоти, донизу друза розходиться до третини ширини.
 *
 * Широкий екран кадрує той самий артефакт інакше: він менший і ближчий до
 * центру, тож зона вужча.
 */
const MONARCH_IN_VIEWPORT = {
  portrait: { centreX: 0.63, tipY: 0.42, tipWidth: 0.15, baseWidth: 0.34 },
  wide: { centreX: 0.54, tipY: 0.44, tipWidth: 0.1, baseWidth: 0.22 },
};

/**
 * Силует монарха, переведений у координати поля сфер.
 *
 * Поле починається під панеллю вкладок і закінчується над доком, тобто його
 * нуль — не нуль вікна. Поки зону рахували в частках поля, вона з'їжджала, і
 * на живому порталі дві сфери сіли просто на камінь.
 */
function monarchKeepOutFor(rect: DOMRect): WishSphereKeepOut {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const source = vw / vh > 1.2 ? MONARCH_IN_VIEWPORT.wide : MONARCH_IN_VIEWPORT.portrait;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  return {
    centreX: (source.centreX * vw - rect.left) / width,
    tipY: (source.tipY * vh - rect.top) / height,
    tipWidth: (source.tipWidth * vw) / width,
    baseWidth: (source.baseWidth * vw) / width,
  };
}

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
}: {
  item: WishlistItemV3;
  place: WishSpherePlacement;
  focused: boolean;
  dimmed: boolean;
  detailsOpen: boolean;
  openDetails: () => void;
  onOpenChange: (id: number, open: boolean) => void;
  still: boolean;
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
      style={{
        '--sphere-x': `${place.x * 100}%`,
        '--sphere-y': `${place.y * 100}%`,
        '--sphere-size': `${place.diameter}px`,
        '--sphere-drift-x': `${place.driftX}px`,
        '--sphere-drift-y': `${place.driftY}px`,
        '--sphere-period': `${place.period}s`,
        '--sphere-phase': `-${place.phase}s`,
        '--sphere-parallax': `${PARALLAX_BY_LAYER[place.layer]}`,
      } as React.CSSProperties}
      onClick={openDetails}
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
  const [keepOut, setKeepOut] = useState<WishSphereKeepOut | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [quality] = useState(readQuality);
  const [still] = useState(prefersReducedMotion);
  const { shown, phase } = useSwappedItems(items, still);

  // Поле міряється, а не вгадується: сузір'я розкладається в пікселях, і
  // розмір сфери заданий часткою меншого боку.
  useLayoutEffect(() => {
    const node = field.current;
    if (node === null) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      setKeepOut(monarchKeepOutFor(box));
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
      subjects: shown.map((item) => ({ id: item.id })),
      field: size,
      quality,
      ...(keepOut === null ? {} : { keepOut }),
    });
  }, [shown, size, quality, keepOut]);

  const placeById = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
  );

  const onOpenChange = useCallback((id: number, open: boolean) => {
    setFocused((current) => (open ? id : current === id ? null : current));
  }, []);

  // Паралакс. Один rAF на все поле, дві CSS-змінні — не фізика й не по кулі.
  useEffect(() => {
    const node = field.current;
    if (node === null || still || !hasFinePointer()) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        node.style.setProperty('--field-tilt-x', String((event.clientX - box.left) / box.width - 0.5));
        node.style.setProperty('--field-tilt-y', String((event.clientY - box.top) / box.height - 0.5));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [still]);

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
