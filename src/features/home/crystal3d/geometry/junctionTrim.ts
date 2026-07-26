// ============================================================
// junctionTrim — обробка стику й зовнішня оболонка (Volume V).
// ------------------------------------------------------------
// Нормативно: CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE §6, `CAI-REQ-005..008`,
// `V5-REQ-013..016`.
//
// Профіль прямо називає сирий перетин незалежно замкнених мешів
// НЕ-ВІДПОВІДНИМ і дозволяє замість дорогої булевої операції «bounded local
// trim + hidden-face removal + sealed junction». Саме це тут і зроблено.
//
// Уся операція зводиться до ОДНОГО правила:
//
//   трикутник знімається з оболонки тоді й лише тоді, коли він увесь
//   лежить усередині якогось ІНШОГО тіла маси.
//
// З нього обидві вимоги профілю випливають самі, без окремих гілок:
//   • `CAI-REQ-005` (кришка основи не частина оболонки) — кришка складається
//     рівно з граней, що мають вершину в ряду 0 профілю; якщо основа
//     похована, вони всі всередині господаря і йдуть разом з рештою
//     прихованих граней. А якщо основа НЕ похована (кореневе тіло, мілке
//     кріплення) — кришка лишається, і наскрізні діри не повертаються.
//     Умовність, якої вимагає конфлікт «кришка проти оболонки», не
//     дописується окремим правилом — вона вбудована в це одне.
//   • `CAI-REQ-007` (сторонні перетини) — перетини з НЕ-господарями нікуди
//     не діваються фізично (розводити тіла ми свідомо відмовились, див.
//     docs/IMPLEMENTATION_STATUS.md), але перестають бути видимими:
//     заглиблені в сусіда грані знімаються так само, як заглиблені в
//     господаря.
//
// Шов «заварюється» самим господарем (`seamPolicy: 'weld'`): після зрізу
// відкрита межа дитини лежить УСЕРЕДИНІ непрозорого тіла господаря, тож
// зовнішня оболонка суцільна. Окреме перехідне кільце потрібне лише там,
// де межа виходить назовні — а такий випадок правило вище й виключає.
//
// Два рішення, які варто пояснити:
//
//  1. Вершини НЕ ущільнюються — переписується лише індекс. Розклад
//     «вершина ↦ (колонка, ряд) профілю» (LatheGeometry: col·profileLen+row)
//     це єдине, за чим кришка основи взагалі впізнається; ущільнення його
//     знищило б, і валідатор більше не міг би перевірити `CAI-REQ-005`
//     незалежно від цього коду. Ціна — кількадесят невикористаних вершин
//     на тіло (позиції все одно вже в буфері, малюються лише індексовані).
//
//  2. Перевіряються не лише три вершини, а й центроїд та середини ребер.
//     Тіла — поверхні обертання з ЗЛАМАНИМ профілем (bevel основи), тобто
//     не опуклі; трикутник із зануреними вершинами теоретично міг би
//     випнутись назовні між ними. Сім проб замість трьох роблять зріз
//     обґрунтованим, а не правдоподібним.
// ============================================================
import * as THREE from 'three';
import { boundsOverlap, breatheMargin, isInsideHost, type HostSolid } from './hostBody';

export interface TrimStats {
  key: string;
  hostKey: string | null;
  trianglesTotal: number;
  trianglesRemoved: number;
  /** Кільце основи повністю занурене в господаря (діагностика `CAI-REQ-005`). */
  capBuried: boolean;
  /** Кришку основи фактично знято з оболонки. */
  capRemoved: boolean;
  /** Ключі тіл, які затуляють грані цього тіла (господар + сторонні перетини). */
  occluders: string[];
}

const noTrim = (key: string, hostKey: string | null, total: number): TrimStats => ({
  key,
  hostKey,
  trianglesTotal: total,
  trianglesRemoved: 0,
  capBuried: false,
  capRemoved: false,
  occluders: [],
});

/** Проби всередині трикутника: центроїд + середини трьох ребер. */
const _probe = new THREE.Vector3();

export function triangleInside(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  occluder: HostSolid,
  margin: number,
): boolean {
  if (
    !isInsideHost(a, occluder, margin) ||
    !isInsideHost(b, occluder, margin) ||
    !isInsideHost(c, occluder, margin)
  ) {
    return false;
  }
  _probe.copy(a).add(b).add(c).multiplyScalar(1 / 3);
  if (!isInsideHost(_probe, occluder, margin)) return false;
  _probe.copy(a).add(b).multiplyScalar(0.5);
  if (!isInsideHost(_probe, occluder, margin)) return false;
  _probe.copy(b).add(c).multiplyScalar(0.5);
  if (!isInsideHost(_probe, occluder, margin)) return false;
  _probe.copy(c).add(a).multiplyScalar(0.5);
  return isInsideHost(_probe, occluder, margin);
}

/**
 * Світові координати вершин тіла (локальна геометрія + трансформ меша).
 * Трансформ береться з аналітичної моделі тіла — тієї самої, що потім
 * стоїть у сцені, тож розбіжності «рахували в одному просторі, малюємо в
 * іншому» бути не може.
 */
export function worldVertices(
  geometry: THREE.BufferGeometry,
  body: HostSolid,
): THREE.Vector3[] {
  const position = geometry.getAttribute('position');
  const quaternion = body.inverseQuaternion.clone().invert();
  const out: THREE.Vector3[] = new Array<THREE.Vector3>(position.count);
  for (let v = 0; v < position.count; v++) {
    out[v] = new THREE.Vector3(position.getX(v), position.getY(v), position.getZ(v))
      .applyQuaternion(quaternion)
      .add(body.position);
  }
  return out;
}

/**
 * Знімає з тіла всі грані, приховані іншими тілами маси. Геометрія
 * змінюється НА МІСЦІ (переписується лише індекс) і повертається та сама —
 * викликач нічого додатково не звільняє.
 *
 * Детермінізм: жодного rng, порядок обходу індексний, кандидати й
 * `occluders` сортуються за ключем. Ті самі входи дають той самий індекс.
 */
export function trimHiddenFaces(
  geometry: THREE.BufferGeometry,
  self: HostSolid,
  hostKey: string | null,
  solids: ReadonlyMap<string, HostSolid>,
): TrimStats {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  if (index === null || position === undefined) {
    const stats = noTrim(self.key, hostKey, 0);
    geometry.userData.trim = stats;
    return stats;
  }
  const triangleCount = index.count / 3;

  // Кандидати на затуляння: усе, крім себе, чиї обмежувальні сфери
  // перетинаються з нашою. Порядок фіксований — за ключем.
  const candidates: HostSolid[] = [];
  for (const solid of solids.values()) {
    if (solid.key !== self.key && boundsOverlap(self, solid)) candidates.push(solid);
  }
  candidates.sort((a, b) => a.key.localeCompare(b.key));
  if (candidates.length === 0) {
    const stats = noTrim(self.key, hostKey, triangleCount);
    geometry.userData.trim = stats;
    return stats;
  }

  const world = worldVertices(geometry, self);
  const profileLen = self.profile.points.length;

  // `CAI-REQ-005`: кільце основи — ряди 0 (осьова точка) і 1 (перше кільце)
  // профілю. Похованим воно вважається лише щодо ГОСПОДАРЯ: це діагностика
  // саме стику, а не випадкового сусідства.
  const host = hostKey === null ? undefined : candidates.find((c) => c.key === hostKey);
  let capBuried = host !== undefined;
  if (host !== undefined) {
    const margin = breatheMargin(self, host);
    for (let v = 0; v < world.length && capBuried; v++) {
      if (v % profileLen <= 1 && !isInsideHost(world[v]!, host, margin)) capBuried = false;
    }
  }

  const kept: number[] = [];
  const occluders = new Set<string>();
  let capSurvived = false;
  for (let t = 0; t < triangleCount; t++) {
    const a = index.getX(t * 3);
    const b = index.getX(t * 3 + 1);
    const c = index.getX(t * 3 + 2);
    let hiddenBy: HostSolid | undefined;
    for (const candidate of candidates) {
      if (triangleInside(world[a]!, world[b]!, world[c]!, candidate, breatheMargin(self, candidate))) {
        hiddenBy = candidate;
        break;
      }
    }
    if (hiddenBy !== undefined) {
      occluders.add(hiddenBy.key);
      continue;
    }
    // Грань вижила. Кришка основи — рівно ті грані, що мають вершину в
    // ряду 0; жодна інша грань лате її не торкається.
    if (a % profileLen === 0 || b % profileLen === 0 || c % profileLen === 0) capSurvived = true;
    kept.push(a, b, c);
  }

  const stats: TrimStats = {
    key: self.key,
    hostKey,
    trianglesTotal: triangleCount,
    trianglesRemoved: triangleCount - kept.length / 3,
    capBuried,
    capRemoved: !capSurvived,
    occluders: [...occluders].sort(),
  };
  if (stats.trianglesRemoved > 0) {
    // Нормалі НЕ перераховуються навмисно: позиції не змінились, тож наявні
    // лишаються коректними, а computeVertexNormals() дав би NaN на вершинах,
    // що більше не входять у жоден трикутник (заборонено CLAUDE.md).
    geometry.setIndex(kept);
  }
  geometry.userData.trim = stats;
  return stats;
}
