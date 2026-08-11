import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  stepWishSpheres,
  wishSpheresAtRest,
  type WishSphereBody,
  type WishSphereObstacle,
} from './wishSphereMotion';
import type { WishSphereKeepOut, WishSpherePlacement } from './wishSphereField';

// ============================================================
// Куля під пальцем — місток між фізикою і DOM.
// ------------------------------------------------------------
// Фізика живе в `wishSphereMotion.ts` і нічого не знає про браузер; тут — усе
// інше: цикл кадрів, перетягування, запис у стилі.
//
// **Стан не в React.** Положення змінюється шістдесят разів на секунду, і
// проганяти це через `setState` означало б шістдесят перемальовувань дерева на
// секунду заради двох чисел у трансформі. Тут стан живе в рефі, а в DOM іде
// один рядок `transform` на кулю.
//
// **Цикл зупиняється.** Коли все стало, кадри не замовляються: телефон не має
// крутити анімацію нерухомої картинки.
// ============================================================

/** Далі за це від точки натискання — це вже не тап, а кидок. */
const TAP_SLOP = 10;

/**
 * Скільки останніх мілісекунд руху дають швидкість кидка.
 *
 * Одна різниця між останніми двома подіями надто шумна: палець перед
 * відпусканням часто завмирає, і кидок виходив би мертвим.
 */
const THROW_WINDOW_MS = 90;

/** Стеля швидкості кидка, пікселів за секунду — щоб куля не зникала за кадр. */
const MAX_THROW_SPEED = 2600;

interface Sample {
  x: number;
  y: number;
  at: number;
}

export interface WishSphereBilliards {
  /** Прив'язати вузол кулі; `null` — вузол зник. */
  register: (id: number, node: HTMLElement | null) => void;
  /** Почати перетягування. */
  onPointerDown: (id: number, event: React.PointerEvent<HTMLElement>) => void;
  /** Чи був останній жест кидком, а не тапом — тоді картку відкривати не треба. */
  wasThrown: (id: number) => boolean;
}

function obstacleFor(
  keepOut: WishSphereKeepOut | null,
  size: { width: number; height: number },
): WishSphereObstacle | undefined {
  if (keepOut === null) return undefined;
  return {
    centreX: keepOut.centreX * size.width,
    tipY: keepOut.tipY * size.height,
    tipWidth: keepOut.tipWidth * size.width,
    baseWidth: keepOut.baseWidth * size.width,
  };
}

export function useWishSphereBilliards({
  places,
  size,
  keepOut,
  still,
  parallaxByLayer,
}: {
  places: readonly WishSpherePlacement[];
  size: { width: number; height: number };
  keepOut: WishSphereKeepOut | null;
  still: boolean;
  parallaxByLayer: Readonly<Record<WishSpherePlacement['layer'], number>>;
}): WishSphereBilliards {
  const bodies = useRef<WishSphereBody[]>([]);
  const tilt = useRef({ x: 0, y: 0 });
  const nodes = useRef(new Map<number, HTMLElement>());
  const layers = useRef(new Map<number, WishSpherePlacement['layer']>());
  const held = useRef<{ id: number; pointer: number; moved: number; samples: Sample[] } | null>(null);
  const thrown = useRef(new Set<number>());
  const frame = useRef(0);
  const last = useRef(0);

  const obstacle = useMemo(() => obstacleFor(keepOut, size), [keepOut, size]);

  // Тіла народжуються з розкладки й переживають перемальовування.
  //
  // Скидається все лише тоді, коли змінився САМ набір: інакше кожен рендер
  // повертав би кулі на початкові місця, і гра тривала б рівно до наступного
  // оновлення даних.
  const signature = places.map((place) => `${place.id}:${place.diameter.toFixed(1)}`).join('|');

  const paint = useCallback(() => {
    for (const body of bodies.current) {
      const node = nodes.current.get(body.id);
      if (node === undefined) continue;
      const layer = layers.current.get(body.id) ?? 'mid';
      const depth = parallaxByLayer[layer];
      // Паралакс складається з фізикою в одному рядку: два власники того
      // самого `transform` затирали б одне одного щокадру.
      const x = body.x - tilt.current.x * depth;
      const y = body.y - tilt.current.y * depth;
      node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }
  }, [parallaxByLayer]);

  // Цикл кадрів мусить брати СВІЖИЙ крок, а не той, з яким його запустили.
  //
  // `requestAnimationFrame(tick)` замовляє конкретне замикання, і воно ж
  // перезамовляє себе далі — тобто цикл, раз запущений, назавжди лишається зі
  // старим світом. Виміряно на живому порталі, і вада була видима з першого
  // погляду: поле міряється після монтування, тож перший кадр замовлявся з
  // розміром 0×0. Поки він чекав своєї черги, розмір приїздив, тіла
  // перебудовувались правильно — а потім прокидався той самий старий кадр,
  // затискав усі сім куль у світ 1×1 і перезамовляв себе. Усе сузір'я лежало
  // купою в лівому верхньому куті.
  const step = useRef<(now: number) => void>(() => {});
  const pump = useCallback((now: number) => { step.current(now); }, []);

  const tick = useCallback((now: number) => {
    frame.current = 0;
    const previous = last.current === 0 ? now : last.current;
    last.current = now;
    const delta = Math.max(0, (now - previous) / 1000);

    bodies.current = stepWishSpheres(bodies.current, {
      width: size.width,
      height: size.height,
      obstacle,
      held: held.current?.id ?? null,
    }, delta);
    paint();

    // Кадри замовляються, лише поки є що рухати.
    if (held.current !== null || !wishSpheresAtRest(bodies.current)) {
      frame.current = window.requestAnimationFrame(pump);
    } else {
      last.current = 0;
    }
  }, [obstacle, paint, pump, size.height, size.width]);

  step.current = tick;

  const wake = useCallback(() => {
    // Поле ще не зміряне — рухати нічого: крок у світі 1×1 лише зіштовхнув би
    // усіх у куток.
    if (still || frame.current !== 0 || size.width < 2 || size.height < 2) return;
    last.current = 0;
    frame.current = window.requestAnimationFrame(pump);
  }, [pump, size.height, size.width, still]);

  // Народження тіл і перше малювання — в одному шарі, і саме в такому порядку.
  //
  // Це не охайність. Тіла створювались ефектом, а малювання стояло в
  // layout-ефекті, тобто РАНІШЕ: на першому кадрі малювати не було чого, і
  // кулі лишались там, куди їх поклав CSS, — купою в лівому верхньому куті.
  // Виміряно на живому порталі: усі сім повідомляли одну й ту саму точку
  // (16, 101), і розлітались вони лише від першого дотику. Ані типізація, ані
  // тести цього не бачили — вони не малюють.
  useLayoutEffect(() => {
    bodies.current = places.map((place) => ({
      id: place.id,
      x: place.x * size.width,
      y: place.y * size.height,
      vx: 0,
      vy: 0,
      radius: place.diameter / 2,
      // Місце з розкладки — і початок, і те, куди куля повернеться, коли її
      // облишать. Стіл лишається столом, але сузір'я збирається саме.
      homeX: place.x * size.width,
      homeY: place.y * size.height,
      calm: 0,
    }));
    layers.current = new Map(places.map((place) => [place.id, place.layer]));
    paint();
    // Один поштовх циклу одразу після народження тіл.
    //
    // Розкладка при повній дошці ставить сусідів упритул і навіть із
    // перекриттям — при 16 бажаннях виміряно до 22 px, — а розсовує їх крок
    // фізики, не вона. Без цього поштовху цикл кадрів не запускався взагалі
    // (усі стоять на своїх місцях і мовчать), і перекриття лишалось на екрані
    // до першого дотику пальцем. Зупиниться він сам, щойно все розійдеться.
    wake();
    // Розкладка вже дала кожній кулі місце; сюди її веде саме `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, size.width, size.height, paint]);

  useEffect(() => () => {
    if (frame.current !== 0) window.cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  // Паралакс — лише там, де є справжній курсор: на телефоні його нічим вести.
  useEffect(() => {
    if (still || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let pending = 0;
    const onMove = (event: PointerEvent) => {
      if (pending !== 0) return;
      pending = window.requestAnimationFrame(() => {
        pending = 0;
        tilt.current = {
          x: event.clientX / Math.max(1, window.innerWidth) - 0.5,
          y: event.clientY / Math.max(1, window.innerHeight) - 0.5,
        };
        // Малюємо самі, бо цикл фізики спить, поки все стоїть.
        if (frame.current === 0) paint();
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (pending !== 0) window.cancelAnimationFrame(pending);
    };
  }, [paint, still]);

  const register = useCallback((id: number, node: HTMLElement | null) => {
    if (node === null) nodes.current.delete(id);
    else nodes.current.set(id, node);
  }, []);

  const onPointerDown = useCallback((id: number, event: React.PointerEvent<HTMLElement>) => {
    if (still) return;
    const node = event.currentTarget;
    const box = node.parentElement?.getBoundingClientRect();
    if (box === undefined) return;
    thrown.current.delete(id);
    held.current = {
      id,
      pointer: event.pointerId,
      moved: 0,
      samples: [{ x: event.clientX, y: event.clientY, at: event.timeStamp }],
    };
    node.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent) => {
      const current = held.current;
      if (current === null || moveEvent.pointerId !== current.pointer) return;
      const previous = current.samples[current.samples.length - 1]!;
      current.moved += Math.hypot(moveEvent.clientX - previous.x, moveEvent.clientY - previous.y);
      current.samples.push({ x: moveEvent.clientX, y: moveEvent.clientY, at: moveEvent.timeStamp });
      if (current.samples.length > 8) current.samples.shift();

      const body = bodies.current.find((item) => item.id === current.id);
      if (body === undefined) return;
      // Куля стоїть рівно під пальцем — не «тягнеться за ним». Затримка тут
      // читалась би як залипання, а не як вага.
      body.x = moveEvent.clientX - box.left;
      body.y = moveEvent.clientY - box.top;
      body.vx = 0;
      body.vy = 0;
      wake();
    };

    const release = (upEvent: PointerEvent) => {
      const current = held.current;
      if (current === null || upEvent.pointerId !== current.pointer) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      held.current = null;

      if (current.moved > TAP_SLOP) {
        thrown.current.add(current.id);
        // Швидкість — із хвоста жесту, а не з останньої пари подій.
        const samples = current.samples;
        const end = samples[samples.length - 1]!;
        const start = samples.find((sample) => end.at - sample.at <= THROW_WINDOW_MS) ?? samples[0]!;
        const seconds = Math.max(0.016, (end.at - start.at) / 1000);
        const body = bodies.current.find((item) => item.id === current.id);
        if (body !== undefined) {
          const vx = (end.x - start.x) / seconds;
          const vy = (end.y - start.y) / seconds;
          const speed = Math.hypot(vx, vy);
          const scale = speed > MAX_THROW_SPEED ? MAX_THROW_SPEED / speed : 1;
          body.vx = vx * scale;
          body.vy = vy * scale;
        }
      }
      wake();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    wake();
  }, [still, wake]);

  const wasThrown = useCallback((id: number) => {
    const was = thrown.current.has(id);
    thrown.current.delete(id);
    return was;
  }, []);

  return { register, onPointerDown, wasThrown };
}
