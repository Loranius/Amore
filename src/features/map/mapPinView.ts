// ============================================================
// Чиста частина карти: що показувати в картці й що робити з маркерами.
// ------------------------------------------------------------
// Без mapbox і без DOM — інакше ці два правила перевірялись би тільки
// очима на живій карті, а обидва встигли зламатись саме мовчки.
// ============================================================
import type { MapPinRow } from '@/types';

/**
 * Текст, який картка показує під назвою.
 *
 * Історія бага: `note` заповнювався при створенні мітки, брав участь у
 * пошуку — і НЕ показувався ніде. `review` з'являвся лише пізніше, при
 * редагуванні. У базі знайшлось десять міток, де це два різні тексти,
 * тобто десять нотаток існували, шукались і були невидимі.
 *
 * Порядок такий: враження (пізніше й свідоміше) головніше за нотатку,
 * але якщо враження немає — показуємо нотатку, а не порожнечу.
 */
export function pinPrimaryText(pin: Pick<MapPinRow, 'review' | 'note'>): string | null {
  const review = pin.review?.trim();
  if (review) return review;
  const note = pin.note?.trim();
  return note || null;
}

/** Чи має мітка ще й другий текст, окрім показаного в картці. */
export function pinHasSecondText(pin: Pick<MapPinRow, 'review' | 'note'>): boolean {
  return !!pin.review?.trim() && !!pin.note?.trim();
}

/**
 * Підпис маркера: усе, від чого залежить його вигляд і місце.
 *
 * Якщо підпис не змінився — маркер чіпати не треба. Саме на цьому
 * тримається `planMarkerSync`.
 */
export function markerSignature(pin: MapPinRow): string {
  return `${pin.lat}|${pin.lng}|${pin.category}`;
}

export interface MarkerPlan {
  /** Створити маркер (новий або той, чий вигляд змінився). */
  add: string[];
  /** Прибрати маркер (зник або буде створений наново). */
  remove: string[];
  /** Лишити як є. */
  keep: string[];
}

/**
 * Що зробити з маркерами, щоб карта збіглася з тим, що має бути.
 *
 * Було: усі маркери знищувались і створювались наново при кожній зміні
 * `pins`. Оскільки будь-яка мутація робить `invalidate`, після кожного
 * збереження оцінки вся карта перемальовувалась — двадцять шість
 * маркерів блимали заради одного зміненого.
 *
 * Працює з ключами, а не з id мітки, бо маркер тепер не завжди одна
 * мітка: після скупчення це може бути жменя міток під одним значком.
 * Обидві сторони — ключ → підпис вигляду.
 */
export function planSync(
  existing: ReadonlyMap<string, string>,
  wanted: ReadonlyMap<string, string>,
): MarkerPlan {
  const plan: MarkerPlan = { add: [], remove: [], keep: [] };

  for (const [key, sig] of wanted) {
    const drawn = existing.get(key);
    if (drawn === undefined) {
      plan.add.push(key);
    } else if (drawn !== sig) {
      // Переїхав або змінив вигляд — простіше перестворити, ніж правити
      // колір, значок і координати поокремо.
      plan.remove.push(key);
      plan.add.push(key);
    } else {
      plan.keep.push(key);
    }
  }

  for (const key of existing.keys()) {
    if (!wanted.has(key)) plan.remove.push(key);
  }
  return plan;
}

// ── Скупчення ────────────────────────────────────────────────

export interface ProjectedPin {
  pin: MapPinRow;
  /** Екранні координати в пікселях (map.project). */
  x: number;
  y: number;
}

export interface PinCluster {
  /** Стабільний ключ: id міток за зростанням. */
  key: string;
  pins: MapPinRow[];
  /** Центр скупчення в пікселях — куди ставити значок. */
  x: number;
  y: number;
}

/**
 * Звести мітки, що злиплись на екрані, в одне скупчення.
 *
 * Рахуємо в ПІКСЕЛЯХ, а не в градусах: злипання — це властивість
 * поточного масштабу, а не географії. Дві мітки за сто метрів одна від
 * одної на масштабі країни це одна пляма, а на масштабі вулиці — два
 * різні заклади, і жоден поріг у градусах цього не розрізнить.
 *
 * Алгоритм навмисно найпростіший: перша мітка задає скупчення й збирає
 * всіх сусідів у радіусі. На двадцяти шести мітках різниця з чесним
 * ієрархічним групуванням непомітна, а поведінка передбачувана.
 *
 * Порядок входу визначає результат, тому виклик має подавати мітки в
 * стабільному порядку — інакше ключі стрибатимуть між перемальовуваннями.
 */
export function clusterPins(points: readonly ProjectedPin[], radius: number): PinCluster[] {
  const taken = new Set<number>();
  const out: PinCluster[] = [];

  for (const seed of points) {
    if (taken.has(seed.pin.id)) continue;
    taken.add(seed.pin.id);
    const members = [seed];

    for (const other of points) {
      if (taken.has(other.pin.id)) continue;
      const dx = other.x - seed.x;
      const dy = other.y - seed.y;
      if (dx * dx + dy * dy <= radius * radius) {
        taken.add(other.pin.id);
        members.push(other);
      }
    }

    const pins = members.map((m) => m.pin);
    out.push({
      key: pins.map((p) => p.id).sort((a, b) => a - b).join(','),
      pins,
      // Центр скупчення, а не позиція першої мітки: інакше значок стояв
      // би збоку від плями, яку він заміняє.
      x: members.reduce((s, m) => s + m.x, 0) / members.length,
      y: members.reduce((s, m) => s + m.y, 0) / members.length,
    });
  }
  return out;
}

/** Підпис вигляду скупчення: ключ уже описує склад, лишається місце. */
export function clusterSignature(cluster: PinCluster): string {
  const single = cluster.pins.length === 1 ? cluster.pins[0] : null;
  return single
    ? markerSignature(single)
    : `cluster:${cluster.pins.length}:${Math.round(cluster.x)}:${Math.round(cluster.y)}`;
}
