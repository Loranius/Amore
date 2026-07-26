// ============================================================
// latheProfile — КАНОНІЧНИЙ профіль тіла кристала (Volume V).
// ------------------------------------------------------------
// Нормативно: docs/02_VOLUMES/VOLUME_V_GEOMETRY_ENGINE.md,
// docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md §6.
//
// Чому окремий модуль. Обробка стику (junctionTrim.ts) мусить знати
// ТОЧНО ту саму поверхню, яку намалює buildBranchGeometry — інакше
// «всередині господаря» рахувалось би по одній геометрії, а різалось по
// іншій, і оболонка розповзлась би. Тому і рендер, і аналітична модель
// господаря (hostBody.ts) беруть профіль ЗВІДСИ, з одного виклику.
//
// Порядок звертань до shapeRng тут зафіксований назавжди: він визначає
// форму кожного тіла, тож будь-яка вставка/перестановка draw-ів змінила б
// вигляд усіх існуючих кристалів (детермінізм — DETERMINISM_STANDARD §3).
// ============================================================
import * as THREE from 'three';
import { mulberry32, hashSeedString } from '../../mulberry32';
import type { ClusterBranch, ClusterMaterial } from '../crystalCluster';

/** Рядок профілю обертання: радіус на висоті y (локальний простір тіла). */
export interface ProfileRow {
  y: number;
  r: number;
}

export interface CrystalProfile {
  /** Кількість граней (кутових колонок лате = segments+1, остання — шов). */
  segments: number;
  /** Поточна («на сьогодні») висота тіла: height·(0.32+0.68·maturity). */
  h: number;
  /** Поточний базовий радіус: radiusBottom·(0.4+0.6·maturity). */
  r: number;
  /** Бічний профіль без осьових кришок (основа → вістря), y строго зростає. */
  side: ProfileRow[];
  /** Повний профіль лате: осьова точка + side + осьова точка (кришки торців). */
  points: THREE.Vector2[];
  /** Амплітуда радіального джиттера граней (частка радіуса, 0..~0.17). */
  jitterAmp: number;
  /** Неоднорідний масштаб пласких архетипів, застосований ПІСЛЯ лате. */
  scaleX: number;
  scaleZ: number;
}

/** Ті самі коефіцієнти зрілості, що в artifact/growthSurface.ts. */
const heightScale = (m: number): number => 0.32 + m * 0.68;
const radiusScale = (m: number): number => 0.4 + m * 0.6;

/**
 * Виводить канонічний профіль тіла. Чиста функція від (branch, material):
 * жодного стану, жодного часу — двічі викликана, дає ідентичний результат.
 */
export function computeCrystalProfile(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'surfaceComplexity' | 'polish'>,
): CrystalProfile {
  const shapeRng = mulberry32(hashSeedString(branch.key));
  // Великі тіла — ВЕЛИКІ чисті грані (референс: кварцовий гексагон, 6-7
  // граней — кожна читається площиною); середні — 7-9 (+шанс зайвої від
  // «складності поверхні»/книг); супутники колоній — дрібні й численні,
  // тому дешевші: 5-6 граней; мікрошар — 4-5 (перф на мобільних GPU).
  const segments =
    branch.role === 'micro'
      ? 4 + Math.floor(shapeRng() * 2)
      : branch.role === 'satellite'
        ? 5 + Math.floor(shapeRng() * 2)
        : 6 + Math.floor(shapeRng() * 3) + (shapeRng() < material.surfaceComplexity ? 1 : 0);
  const m = branch.maturity;

  const h = branch.height * heightScale(m);
  const r = branch.radiusBottom * radiusScale(m);
  // Архетип (Composition Framework) реалізується тут ЛИШЕ формою профілю —
  // пропорції вже виставив композитор, матеріали його не обходять.
  const arch = branch.archetype;
  const blunt = arch === 'prismatic' || arch === 'tabular' || arch === 'massive';
  const tipR = blunt ? r * 0.28 : r * (0.14 - m * 0.12); // молоді — тупіші вістря, зрілі — майже гострі
  const prismEnd = (arch === 'prismatic' ? 0.6 : 0.46) + shapeRng() * 0.08;
  // pointStart МУСИТЬ бути помітно вище prismEnd (інакше профіль самоперетнеться
  // при високій maturity, де 0.72-m*0.2 може впасти аж до 0.52) — тому явно
  // прив'язаний до prismEnd з запасом, а не рахується незалежно.
  const pointStart = Math.max(prismEnd + 0.14, 0.72 - m * 0.2 + shapeRng() * 0.08);

  // Профіль: ЗАОКРУГЛЕНА ВУЗЬКА основа → призматична ділянка → пірамідальне
  // вістря. Основа не широка пласка «спідниця» з гострим кутом (яка читалась
  // як обрубок), а вужча за призму й плавно скруглена вгору (r·0.6 →
  // біля-повний радіус через м'який bevel) — низ кристала виглядає
  // обточеним, як у справжнього мінералу, і займає менше місця (менше
  // налазить на сусідів). 'broken' — зрізана верхівка нижче повної висоти.
  const baseR = r * 0.6;
  const bevelR = r * 0.9;
  const side: ProfileRow[] =
    arch === 'broken'
      ? [
          { r: baseR, y: 0 },
          { r: bevelR, y: h * 0.05 },
          { r, y: h * (0.13 + shapeRng() * 0.03) },
          { r: r * (0.96 + shapeRng() * 0.04), y: h * Math.min(prismEnd, 0.6) },
          { r: r * (0.3 + shapeRng() * 0.08), y: h * 0.84 },
          { r: 0.06 * r, y: h * 0.85 },
        ]
      : [
          { r: baseR, y: 0 },
          { r: bevelR, y: h * 0.05 },
          { r, y: h * (0.13 + shapeRng() * 0.03) },
          { r: r * (0.96 + shapeRng() * 0.04), y: h * prismEnd },
          { r: r * (0.9 + shapeRng() * 0.06), y: h * pointStart },
          { r: Math.max(0.001, tipR), y: h },
        ];

  // ЗАКРИТІ торці: LatheGeometry — поверхня обертання з ВІДКРИТИМИ кінцями,
  // тож без кришок видно наскрізь у порожнє нутро. Осьова точка (r≈0) перед
  // основою і після вістря дає суцільний диск-кришку. Кришку основи, що
  // цілком опинилась усередині господаря, потім знімає junctionTrim
  // (`CAI-REQ-005`) — саме тому вона будується завжди, а не «про всяк
  // випадок ніколи»: кореневим тілам вона потрібна.
  const first = side[0]!;
  const last = side[side.length - 1]!;
  const points = [
    new THREE.Vector2(0.0001, first.y),
    ...side.map((p) => new THREE.Vector2(p.r, p.y)),
    new THREE.Vector2(0.0001, last.y),
  ];

  // Амплітуда джиттера граней стала на все тіло: «Фото → Polishing Pressure»
  // гамує її глобально, ієрархія — локально (велике = чисте, дрібне =
  // шорстке), 'etched' — протравлені грані поверх усіх правил.
  const hierarchy =
    (branch.primary ? 0.15 : branch.role !== 'dominant' ? 1.25 : 1) * (1 - 0.4 * branch.maturity);
  const jitterAmp = 0.08 * (1 - material.polish * 0.6) * hierarchy * (arch === 'etched' ? 1.7 : 1);

  // Пласкі архетипи: blade — лезо (сильний сплюск по X), tabular —
  // таблитчастий (ширший і нижчий, помірний сплюск).
  const scaleX = arch === 'blade' ? 0.45 : arch === 'tabular' ? 1.1 : 1;
  const scaleZ = arch === 'blade' ? 1 : arch === 'tabular' ? 0.5 : 1;

  return { segments, h, r, side, points, jitterAmp, scaleX, scaleZ };
}

/**
 * Номінальний радіус профілю на локальній висоті y (кусково-лінійна
 * інтерполяція між рядками side). Поза [0, h] повертає 0 — тіло там не
 * існує. Лінійність точна: лате будує саме прямі твірні між рядками.
 */
export function nominalRadiusAt(profile: CrystalProfile, y: number): number {
  const { side } = profile;
  const first = side[0]!;
  const last = side[side.length - 1]!;
  if (y < first.y || y > last.y) return 0;
  for (let i = 1; i < side.length; i++) {
    const lo = side[i - 1]!;
    const hi = side[i]!;
    if (y <= hi.y) {
      const span = hi.y - lo.y;
      if (span <= 1e-9) return Math.min(lo.r, hi.r);
      const k = (y - lo.y) / span;
      return lo.r + (hi.r - lo.r) * k;
    }
  }
  return last.r;
}
