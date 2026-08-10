import { CRYSTAL_SUBSTRATE_BODY_ID, type CrystalGeometryState } from '@/engine/geometry';
import { mulberry32 } from '../../mulberry32';

// ============================================================
// Бажання, які ще не збулись — кристали навколо корони (бриф §28–§29).
// ------------------------------------------------------------
// **Чому це не рушій.** Evolution Engine моделює те, що *сталося*: адаптер
// вішліста бере рівно виконані бажання (`if (!row.fulfilled) continue`), і
// опублікований стан незмінний. Активне бажання — не подія, воно змінюється
// щодня і завтра може зникнути. Вставити його в конвеєр означало б зробити
// історію мінливою.
//
// Тож ці кристали — шар світу, а не рушія: presentation поточного стану
// застосунку навколо артефакта. Мінеральна сім'я при цьому та сама не за
// схожістю, а буквально — рендер бере готову геометрію доньки монарха
// (див. `WishCrystals.tsx`), тож нової форми тут не вигадується.
//
// **Що вже є.** Збуте бажання й так змінює артефакт: `wishTint` фарбує всю
// друзу від подарунків, які пара зробила одне одному (ADR-0015). Тобто §31
// брифу — «збуте бажання входить у тіло каменю» — наполовину вже правда, і
// ці супутники домальовують другу половину: те, чого ще прагнуть.
// ============================================================

/** Розміри монарха в одиницях рушія — супутники розставляються від них. */
export interface WishSatelliteBounds {
  height: number;
  radius: number;
}

export interface WishSatellite {
  /** Позиція в одиницях рушія, у кадрі `bundle.content`. */
  position: readonly [number, number, number];
  /** Множник до розміру донорської геометрії. */
  scale: number;
  rotationY: number;
  /** Нахил від вертикалі, радіани. */
  tilt: number;
  /**
   * Скільки бажань стоїть за цим кристалом.
   *
   * §29 прямо забороняє показувати сотні одночасно й просить натомість
   * кластери або пріоритизацію. Останній супутник збирає залишок, тож сума
   * `represents` завжди дорівнює числу активних бажань — на екрані їх менше,
   * але жодне не зникає безслідно.
   */
  represents: number;
}

export type WishSatelliteQuality = 'high' | 'balanced' | 'low' | 'fallback';

/**
 * Скільки кристалів світ погоджується малювати.
 *
 * Не «скільки влізе»: це друга сцена поверх артефакта, і §43 називає
 * постійну WebGL-пам'ять першим ризиком. Одна інстансована сітка на всіх,
 * але вершини все одно множаться.
 */
export function wishSatelliteCap(quality: WishSatelliteQuality): number {
  if (quality === 'high') return 12;
  if (quality === 'balanced') return 9;
  if (quality === 'low') return 6;
  // Запасний профіль малює артефакт і більше нічого.
  return 0;
}

export interface WishSatelliteInput {
  /** Скільки бажань пари ще не збулось. */
  activeWishes: number;
  /** Насіння артефакта — у кожної пари свій розсип, і він незмінний. */
  seed: number;
  bounds: WishSatelliteBounds;
  quality: WishSatelliteQuality;
}

/** Золотий кут — розкладка, у якій сусіди ніколи не збігаються за напрямком. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Найближче до осі, куди дозволено ставити супутник, як частка радіуса друзи.
 *
 * Більше за одиницю навмисно: монарх звужується догори, але його доньки
 * стоять унизу й широко, і «трохи всередині радіуса» на висоті корони — це
 * все одно перетин із гілкою друзи. Перевірка `hypot(x, z) > radius` — те, що
 * тримає тест, і вона можлива саме тому, що поріг абсолютний.
 */
const MIN_ORBIT = 1.04;
const MAX_ORBIT = 1.12;

/**
 * Смуга висот, у якій живуть бажання: плечі монарха, не вище вістря.
 *
 * Було 0.72–1.06, тобто трохи вище вершини. На живому порталі верхні
 * супутники зрізало краєм екрана: кадр будується під сам артефакт, і запасу
 * над вістрям на вертикальному телефоні майже немає.
 */
const MIN_RISE = 0.58;
const MAX_RISE = 0.96;

/**
 * Висота супутника як частка висоти монарха, до розкиду.
 *
 * Було 0.085 — на живому порталі це читалось як уламки завбільшки з доньку,
 * а не як дрібні кристали бажань, яких просить §29.
 */
const SATELLITE_HEIGHT_SHARE = 0.05;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function buildWishSatellites(input: WishSatelliteInput): readonly WishSatellite[] {
  const cap = wishSatelliteCap(input.quality);
  const active = Math.max(0, Math.floor(finite(input.activeWishes, 0)));
  const shown = Math.min(active, cap);
  if (shown === 0) return [];

  const height = Math.max(1e-3, finite(input.bounds.height, 1));
  const radius = Math.max(1e-3, finite(input.bounds.radius, 1));
  const random = mulberry32(Math.floor(finite(input.seed, 0)) >>> 0);
  // Одна фаза на всю розкладку, а не випадковий кут у кожного: інакше
  // «трохи різні» ставали б «як попало», і на екрані це читається як шум.
  const phase = random() * Math.PI * 2;

  const satellites: WishSatellite[] = [];
  for (let index = 0; index < shown; index += 1) {
    // frac іде від 0 до 1 по всій розкладці — так висота й орбіта
    // розподіляються рівно, скільки б бажань не було.
    const frac = shown === 1 ? 0.5 : index / (shown - 1);
    const angle = phase + index * GOLDEN_ANGLE;
    const orbit = radius * (MIN_ORBIT + (MAX_ORBIT - MIN_ORBIT) * random());
    const rise = height * (MIN_RISE + (MAX_RISE - MIN_RISE) * frac);
    const jitter = 0.86 + random() * 0.28;

    // Останній збирає залишок (§29): на екрані дванадцять кристалів, а
    // бажань за ними може бути скільки завгодно.
    const last = index === shown - 1;
    const represents = last ? active - shown + 1 : 1;
    // Росте від кількості, але повільно: кластер із тридцяти не має бути
    // втричі більшим за одиничне бажання, інакше він читається як другий
    // монарх.
    const cluster = represents > 1 ? 1 + Math.min(0.5, Math.log2(represents) * 0.14) : 1;

    satellites.push({
      position: [
        Math.cos(angle) * orbit,
        rise,
        Math.sin(angle) * orbit,
      ],
      scale: height * SATELLITE_HEIGHT_SHARE * jitter * cluster,
      rotationY: random() * Math.PI * 2,
      tilt: (random() - 0.5) * 0.5,
      represents,
    });
  }

  return satellites;
}

/**
 * Габарити монарха в одиницях рушія.
 *
 * Береться з опублікованої геометрії, а не з кадру сцени: супутники живуть у
 * тому ж кадрі, що й тіла, і перерахунок через підгонку означав би друге
 * джерело правди про те, який артефакт описується.
 */
export function wishSatelliteBounds(geometry: CrystalGeometryState): WishSatelliteBounds {
  let height = 0;
  let radius = 0;
  for (const mesh of geometry.meshes) {
    if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
    const positions = mesh.positions;
    for (let index = 0; index + 2 < positions.length; index += 3) {
      const y = positions[index + 1]!;
      if (y > height) height = y;
      const span = Math.hypot(positions[index]!, positions[index + 2]!);
      if (span > radius) radius = span;
    }
  }
  return { height, radius };
}

/**
 * Найменше справжнє тіло пари — форма, яку позичають бажання.
 *
 * §29 просить, щоб бажання належали тій самій мінеральній сім'ї, що й монарх.
 * Позичити готову доньку — найкоротший спосіб зробити це правдою, а не
 * схожістю: та сама огранка, ті самі атрибути фасетів, той самий матеріал.
 */
export function pickWishDonor(
  geometry: CrystalGeometryState,
): CrystalGeometryState['meshes'][number] | null {
  let donor: CrystalGeometryState['meshes'][number] | null = null;
  let donorSpan = Infinity;
  for (const mesh of geometry.meshes) {
    if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
    if (mesh.positions.length < 9) continue;
    let low = Infinity;
    let high = -Infinity;
    for (let index = 1; index < mesh.positions.length; index += 3) {
      const y = mesh.positions[index]!;
      if (y < low) low = y;
      if (y > high) high = y;
    }
    const span = high - low;
    if (span > 0 && span < donorSpan) {
      donorSpan = span;
      donor = mesh;
    }
  }
  return donor;
}

/**
 * Чого коштує хмара бажань — публікується окремо від артефакта.
 *
 * Той самий прийом, що й для оточення порталу: бюджет артефакта має лишатись
 * про артефакт. Без цього приймальний тест порівнював би намальовані трикутники
 * з топологією друзи й бачив би, що їх стало більше — бо донька, позичена
 * дванадцять разів, порахована в топології один раз.
 */
export function wishCrystalCost(
  geometry: CrystalGeometryState,
  activeWishes: number,
  quality: WishSatelliteQuality,
): { instances: number; triangles: number } {
  const satellites = buildWishSatellites({
    activeWishes,
    seed: geometry.artifactSeed,
    bounds: wishSatelliteBounds(geometry),
    quality,
  });
  const donor = pickWishDonor(geometry);
  if (satellites.length === 0 || donor === null) return { instances: 0, triangles: 0 };
  return {
    instances: satellites.length,
    triangles: satellites.length * Math.floor(donor.positions.length / 9),
  };
}
