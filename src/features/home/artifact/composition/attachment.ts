// ============================================================
// AttachmentJunction — канонічний семантичний запис кріплення host↔child.
// ------------------------------------------------------------
// Нормативно: docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md §3,
// Volume IV (`V4-REQ-013..015`), `CAI-REQ-004`.
//
// Розподіл відповідальності:
//   • Volume III (Growth) фіксує СИРІ факти контакту в момент відкладення
//     (host, точка/нормаль на поверхні господаря, глибина занурення) —
//     `AttachmentContact` в artifactTypes.ts;
//   • Volume IV (Composition) ПУБЛІКУЄ версійований AttachmentJunction уже
//     з ФІНАЛЬНОЇ геометрії (після силуету/віку/маси/колоній), додаючи
//     політики: зона дозволеного перетину, кліренс, trim/seam, ширина
//     матеріального переходу;
//   • Volume V (Geometry) споживає junction і робить зовнішню оболонку.
//
// Модуль лишається species-agnostic: жодних THREE/матеріалів, лише
// геометрія й ідентичність.
// ============================================================
import { type Vec3, add, scale, sub, dot, normalize, lengthOf, perpendicularBasis, v3 } from '../vec3';

/** Версія формату junction — росте при зміні семантики полів. */
export const ATTACHMENT_JUNCTION_VERSION = '1.0.0';

/** Політика вирізання геометрії в зоні стику (Vol V). */
export type TrimPolicy = 'analytic-clip' | 'local-boolean' | 'junction-mesh';
/** Політика ущільнення шва (Vol V). */
export type SeamPolicy = 'weld' | 'sealed-transition';

/**
 * Канонічний запис кріплення. Семантично еквівалентний §3 профілю; поля
 * тримаємо у Vec3 (а не readonly-кортежах), бо це внутрішній контракт
 * рушія — серіалізація в кортежі робиться на межі публікації.
 */
export interface AttachmentJunction {
  readonly junctionId: string;
  readonly hostComponentId: string;
  readonly childComponentId: string;
  readonly hostAnchorId: string;
  readonly childAnchorId: string;
  /** Локальна рамка контакту: початок + ортонормований базис. */
  readonly localFrame: Readonly<{
    origin: Vec3;
    normal: Vec3;
    tangent: Vec3;
    bitangent: Vec3;
  }>;
  /** Радіус плями контакту (≈ радіус основи дитини). */
  readonly contactRadius: number;
  /** Наскільки глибоко основа дитини сидить у тілі господаря. */
  readonly penetrationDepth: number;
  /** Радіус зони, у якій не має бути СТОРОННІХ тіл. */
  readonly clearanceRadius: number;
  /** ЄДИНА область, де дозволено перетин об'ємів host/child. */
  readonly allowedIntersectionBounds: Readonly<{
    center: Vec3;
    radius: number;
    halfDepth: number;
  }>;
  readonly trimPolicy: TrimPolicy;
  readonly seamPolicy: SeamPolicy;
  readonly materialBlendWidth: number;
  readonly version: string;
}

/** Мінімальний опис тіла, з якого будується junction (species-agnostic). */
export interface JunctionBody {
  key: string;
  anchor: Vec3;
  direction: Vec3;
  length: number;
  radius: number;
  /** Ключ господаря; null — тіло вкорінене у віртуальному ядрі (не фізичне). */
  hostKey: string | null;
}

/** Те саме звуження, що в growthSurface: радіус тіла на частці довжини t. */
const TAPER = 0.7;
const radiusAt = (radius: number, t: number): number => radius * (1 - TAPER * Math.max(0, Math.min(1, t)));

/**
 * Проєкція точки на вісь тіла: повертає частку довжини t (клемплену) і
 * найближчу точку осі. Основа junction-геометрії — усе інше похідне.
 */
function projectOnAxis(body: JunctionBody, p: Vec3): { t: number; axisPoint: Vec3 } {
  const rel = sub(p, body.anchor);
  const along = body.length > 1e-9 ? dot(rel, body.direction) / body.length : 0;
  const t = Math.max(0, Math.min(1, along));
  return { t, axisPoint: add(body.anchor, scale(body.direction, t * body.length)) };
}

/**
 * Будує канонічний junction із ФІНАЛЬНИХ геометрій господаря й дитини.
 * Рамка рахується заново (а не береться з моменту відкладення), бо
 * композиція встигла посунути/нахилити/вкоротити тіла — запис мусить
 * описувати те, що реально піде в геометрію.
 */
export function buildJunction(host: JunctionBody, child: JunctionBody): AttachmentJunction {
  // Точка контакту — основа дитини, спроєктована на поверхню господаря.
  const { t, axisPoint } = projectOnAxis(host, child.anchor);
  const radial = sub(child.anchor, axisPoint);
  const radialLen = lengthOf(radial);
  const hostR = radiusAt(host.radius, t);
  const outward = radialLen > 1e-9 ? scale(radial, 1 / radialLen) : child.direction;
  const origin = add(axisPoint, scale(outward, hostR));

  // Нормаль стику: назовні від осі господаря, підмішано напрямок росту
  // дитини — так рамка описує реальний «вихід» тіла з поверхні.
  const normal = normalize(add(scale(outward, 0.65), scale(child.direction, 0.35)));
  const [tangent, bitangent] = perpendicularBasis(normal);

  // Глибина занурення: наскільки основа дитини нижча за поверхню господаря
  // (додатна, коли основа всередині тіла).
  const penetrationDepth = Math.max(0, hostR - radialLen);
  const contactRadius = Math.max(1e-4, child.radius);

  return {
    junctionId: `${host.key}->${child.key}`,
    hostComponentId: host.key,
    childComponentId: child.key,
    hostAnchorId: `${host.key}@${t.toFixed(4)}`,
    childAnchorId: `${child.key}@base`,
    localFrame: { origin, normal, tangent, bitangent },
    contactRadius,
    penetrationDepth,
    // Зона, вільна від сторонніх тіл, — трохи ширша за пляму контакту.
    clearanceRadius: contactRadius * 1.6,
    allowedIntersectionBounds: {
      center: origin,
      radius: contactRadius * 1.25,
      halfDepth: Math.max(penetrationDepth, contactRadius * 0.5),
    },
    // Наші тіла — відомі lathe-профілі, тож аналітичний кліп є першою
    // преференцією самого профілю (§10 Performance Policy).
    trimPolicy: 'analytic-clip',
    seamPolicy: 'weld',
    materialBlendWidth: contactRadius * 0.35,
    version: ATTACHMENT_JUNCTION_VERSION,
  };
}

/**
 * Публікує junction-и для всієї маси. Тіла, вкорінені у віртуальному ядрі
 * (hostKey === null) або чий господар не потрапив у фінальний набір,
 * junction НЕ отримують — це кореневі/осиротілі тіла, і саме їх ловить
 * валідація (`CAI-REQ-004`).
 *
 * Порядок детермінований (за junctionId), як вимагає `V4-REQ-014`.
 */
export function buildJunctions(bodies: readonly JunctionBody[]): AttachmentJunction[] {
  const byKey = new Map(bodies.map((b) => [b.key, b]));
  const junctions: AttachmentJunction[] = [];
  for (const child of bodies) {
    if (child.hostKey === null) continue;
    const host = byKey.get(child.hostKey);
    if (host === undefined) continue; // осиротіле — звіт валідації, не junction
    junctions.push(buildJunction(host, child));
  }
  junctions.sort((a, b) => a.junctionId.localeCompare(b.junctionId));
  return junctions;
}

/** Тіла, що посилаються на неіснуючого господаря (порушення `CAI-REQ-004`). */
export function findOrphans(bodies: readonly JunctionBody[]): string[] {
  const keys = new Set(bodies.map((b) => b.key));
  return bodies
    .filter((b) => b.hostKey !== null && !keys.has(b.hostKey))
    .map((b) => b.key)
    .sort();
}

/** Заглушка нульового вектора для зовнішніх споживачів рамки. */
export const ZERO_VEC: Vec3 = v3(0, 0, 0);
