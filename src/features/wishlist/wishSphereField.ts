import { mulberry32 } from '@/features/home/mulberry32';

// ============================================================
// Сузір'я бажань — просторова композиція вішліста.
// ------------------------------------------------------------
// **Чому не сітка.** Попередня редакція розкладала бажання рядами й колонками
// навколо монарха, і власник назвав це прямо: «item item / monarch / item
// item» треба прибрати повністю. Вішліст має власну просторову мову — сфери
// висять сузір'ям, а не стоять шеренгою.
//
// **Чому не рушій і не сцена.** Сфери — presentation layer самого модуля:
// вони не дочірня геометрія монарха, не залежать від Growth Engine і не мають
// його життєвого циклу. Монарх лишається фоном, який тримає Amore одним
// світом, і нічого не вирішує про вішліст.
//
// **Чому не справжній random.** Позиція мусить бути стабільною між
// перемальовуваннями: сфера, що стрибає на кожен rerender, — це не сузір'я, а
// шум. Тут усе виводиться з id бажання, тож те саме бажання щоразу приходить
// на те саме місце.
// ============================================================

export type WishSphereLayer = 'far' | 'mid' | 'near';

export interface WishSphereSubject {
  id: number;
}

/** Розмір області, у якій живе сузір'я, у пікселях. */
export interface WishSphereFieldSize {
  width: number;
  height: number;
}

export interface WishSpherePlacement {
  id: number;
  /** Частка ширини поля, 0..1. */
  x: number;
  /** Частка висоти поля, 0..1. */
  y: number;
  layer: WishSphereLayer;
  /** Видимий діаметр у пікселях. */
  diameter: number;
  /** Розмах повільного дрейфу, пікселі. */
  driftX: number;
  driftY: number;
  /** Період дихання, секунди. */
  period: number;
  /** Зсув фази, секунди: сусіди не гойдаються в такт. */
  phase: number;
}

export type WishSphereQuality = 'high' | 'balanced' | 'low' | 'fallback';

/**
 * Скільки сфер показувати.
 *
 * Стеля лишається, хоч сфери й дешевші за тіла: два десятки прозорих кіл із
 * власним світінням — це вже помітна робота композитора на телефоні, а сотня
 * бажань в одному кадрі не читається за жодної ціни.
 */
export function wishSphereCapacity(quality: WishSphereQuality): number {
  if (quality === 'high') return 16;
  if (quality === 'balanced') return 13;
  return 10;
}

/** Поля, у які сузір'я не заходить: угорі вкладки, внизу док і кнопка шарів. */
const TOP_BAND = 0.16;
const BOTTOM_BAND = 0.86;
/** Відступ від бічних країв, у частках ширини. */
const SIDE_MARGIN = 0.1;

/**
 * Силует монарха — заборонена зона, у координатах самого поля.
 *
 * Приходить ззовні, а не задана тут сталими, і це виміряна необхідність:
 * поле сфер починається під панеллю вкладок, а монарх стоїть у вікні. Поки
 * зона рахувалась у частках поля, вона з'їжджала вгору й убік — на живому
 * порталі дві сфери сіли просто на камінь. Перерахунок з вікна в поле робить
 * компонент, який єдиний знає, де поле лежить.
 */
export interface WishSphereKeepOut {
  /** Вісь монарха в частках ширини поля. */
  centreX: number;
  /** Висота вершини в частках висоти поля; вище неї зона порожня. */
  tipY: number;
  /** Півширина силуету біля вершини і біля низу кадру, у частках ширини. */
  tipWidth: number;
  baseWidth: number;
}

/** Зона за замовчуванням: приблизно те, що видно на вертикальному телефоні. */
export const DEFAULT_MONARCH_KEEP_OUT: WishSphereKeepOut = {
  centreX: 0.5,
  tipY: 0.34,
  tipWidth: 0.14,
  baseWidth: 0.4,
};

export function monarchKeepOut(keepOut: WishSphereKeepOut, y: number): number {
  const tip = finite(keepOut.tipY, 0.34);
  if (!Number.isFinite(y) || y < tip) return 0;
  const depth = tip >= 1 ? 1 : Math.min(1, Math.max(0, (y - tip) / (1 - tip)));
  const near = Math.max(0, finite(keepOut.tipWidth, 0.14));
  const far = Math.max(near, finite(keepOut.baseWidth, 0.4));
  return near + depth * (far - near);
}

/**
 * Глибина трьома шарами — делікатно.
 *
 * Розкид тримається так, щоб і найдальша сфера лишалась у діапазоні, який
 * назвав власник: 44–64 px на телефоні. Перша редакція мала far 0.8 при
 * ширшій базі, і на живому порталі дальні сфери виходили по 38 px.
 */
const LAYER_SCALE: Readonly<Record<WishSphereLayer, number>> = {
  far: 0.86,
  mid: 1,
  near: 1.12,
};

/** Скільки місця сфера лишає навколо себе, у власних діаметрах. */
const SPACING = 1.18;
/** Скільки детермінованих спроб дає кожній сфері розкладка. */
const ATTEMPTS = 96;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function layerOf(unit: number): WishSphereLayer {
  if (unit < 0.34) return 'far';
  if (unit < 0.72) return 'mid';
  return 'near';
}

/**
 * Базовий діаметр сфери в пікселях.
 *
 * Власник задав орієнтир прямо: 44–64 px на телефоні, і жодних куль по сто.
 * Тому це частка меншого боку поля, затиснута в межі — на планшеті сфери не
 * розростаються, на вузькому екрані не зникають.
 */
export function wishSphereBaseDiameter(field: WishSphereFieldSize): number {
  const width = Math.max(1, finite(field.width, 360));
  const height = Math.max(1, finite(field.height, 640));
  return Math.min(57, Math.max(52, Math.min(width, height) * 0.135));
}

export interface WishSphereFieldInput {
  subjects: readonly WishSphereSubject[];
  field: WishSphereFieldSize;
  quality: WishSphereQuality;
  /** Силует монарха в координатах поля; без нього береться приблизний. */
  keepOut?: WishSphereKeepOut;
}

/**
 * Розкладає бажання сузір'ям.
 *
 * Кожна сфера отримує власний детермінований генератор, засіяний її id: місце,
 * шар, розмір і фаза дрейфу — усе звідти. Розкладка перебирає до `ATTEMPTS`
 * кандидатів і бере перший, що не наліг на сусіда, не заліз у силует монарха й
 * не виїхав за поля; якщо жоден не підійшов, лишається найкращий із бачених.
 * Перебір скінченний і детермінований, тож результат той самий за тих самих
 * вхідних даних.
 */
export function buildWishSphereField(
  input: WishSphereFieldInput,
): readonly WishSpherePlacement[] {
  const capacity = wishSphereCapacity(input.quality);
  const subjects = input.subjects.slice(0, capacity);
  if (subjects.length === 0) return [];

  const width = Math.max(1, finite(input.field.width, 360));
  const height = Math.max(1, finite(input.field.height, 640));
  const base = wishSphereBaseDiameter(input.field);
  const keepOut = input.keepOut ?? DEFAULT_MONARCH_KEEP_OUT;
  const axis = Math.min(1, Math.max(0, finite(keepOut.centreX, 0.5)));

  const placed: WishSpherePlacement[] = [];
  for (const subject of subjects) {
    const random = mulberry32((Math.floor(finite(subject.id, 0)) >>> 0) ^ 0x9e3779b9);
    const layer = layerOf(random());
    const diameter = base * LAYER_SCALE[layer];
    // Півширина й піввисота сфери в частках поля — усе порівняння йде в них.
    const halfX = (diameter / 2) / width;
    const halfY = (diameter / 2) / height;

    let best: { x: number; y: number; score: number } | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const x = SIDE_MARGIN + halfX + random() * Math.max(0, 1 - 2 * (SIDE_MARGIN + halfX));
      const y = TOP_BAND + halfY + random() * Math.max(0, BOTTOM_BAND - TOP_BAND - 2 * halfY);

      // Наскільки сфера не долізла до монарха: від'ємне — вона на ньому.
      const clearance = Math.abs(x - axis) - halfX - monarchKeepOut(keepOut, y);
      let nearest = Infinity;
      for (const other of placed) {
        const wanted = ((diameter + other.diameter) / 2) * SPACING;
        const dx = (x - other.x) * width;
        const dy = (y - other.y) * height;
        nearest = Math.min(nearest, Math.hypot(dx, dy) - wanted);
      }
      // Обидві умови в одній величині: більша — вільніше стоїть.
      const score = Math.min(clearance * width, nearest === Infinity ? width : nearest);
      if (best === null || score > best.score) best = { x, y, score };
      if (score > 0) break;
    }

    // Останній рубіж: якщо жоден кандидат не вийшов чистим, найкращий із них
    // все одно виштовхується з силуету монарха. Це не смак — це вимога, і
    // порушити її не можна навіть тоді, коли місця обмаль; тіснота між самими
    // сферами при повній дошці — менша з двох бід.
    const spot = best ?? { x: axis, y: 0.5, score: 0 };
    const forbidden = monarchKeepOut(keepOut, spot.y) + halfX;
    if (Math.abs(spot.x - axis) < forbidden) {
      const side = spot.x < axis ? -1 : 1;
      const pushed = axis + side * forbidden;
      spot.x = Math.min(1 - halfX, Math.max(halfX, pushed));
    }
    placed.push({
      id: subject.id,
      x: spot.x,
      y: spot.y,
      layer,
      diameter,
      // §11: дуже повільно й майже непомітно. Це не орбіта і не пульс.
      driftY: 3 + random() * 4,
      driftX: 1 + random() * 3,
      period: 5 + random() * 4,
      phase: random() * 9,
    });
  }

  return placed;
}
