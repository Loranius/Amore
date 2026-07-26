// ============================================================
// validateTopology — топологія оболонки після зрізу (Volume V).
// ------------------------------------------------------------
// Нормативно: TESTING_VALIDATION_STRATEGY «Geometry Integrity Tests»
// (manifold/boundary policy at the sealed junction; duplicate/coplanar face
// and z-fighting risk detection), `CAI-REQ-006`.
//
// Чому межа оболонки перевіряється аж тепер. У Phase 3 я цю перевірку
// відклав як нездійсненну: після ущільнення вершин індекси втрачали зв'язок
// із розкладом лате, а без нього «ребро, використане одним трикутником» не
// відрізнити від шва. Ущільнення я тоді свідомо не зробив — і саме це
// зробило перевірку можливою зараз. Канонізація точна, без евристик:
//   • колонка `segments` — дублікат колонки 0 (шов лате замикає оберт);
//   • рядки 0 і profileLen−1 — осьові точки торців; лате розкидає їх по
//     крихітному колу радіуса 1e-4, але це та сама точка осі, тож усі
//     вершини ряду згортаються в один ідентифікатор.
// Після канонізації справжня межа — це справді межа, і `CAI-REQ-006`
// вимагає, щоб кожна така межа лежала всередині господаря: інакше крізь
// неї видно порожнє нутро.
// ============================================================
import * as THREE from 'three';
import { boundsOverlap, breatheMargin, isInsideHost } from './hostBody';
import { worldVertices } from './junctionTrim';
import type { ShellEntry } from './validateShell';

export type TopologyViolationKind =
  /** Грань нульової площі — сміття, що дає NaN-нормалі й z-fighting. */
  | 'degenerate-face'
  /** Та сама трійка вершин двічі в одному тілі. */
  | 'duplicate-face'
  /** Відкрита межа виходить за поверхню господаря (`CAI-REQ-006`). */
  | 'open-boundary-outside'
  /** Майже збіжні грані РІЗНИХ тіл — ризик z-fighting. */
  | 'coplanar-overlap';

export interface TopologyViolation {
  kind: TopologyViolationKind;
  key: string;
  detail: string;
}

/** Площа, нижче якої грань вважається виродженою (світові одиниці²). */
const MIN_AREA = 1e-10;

/**
 * Поріг «майже збіжних» граней. Підібраний вимірюванням, не з голови:
 * ерозія на «дихання» лишає незрізаними грані в межах
 * BREATHE_AMPLITUDE·(h₁+h₂) від поверхні сусіда — для типової пари це
 * ~0.02..0.05 світових одиниць. Ризик z-fighting виникає на порядок ближче,
 * тому 0.002: усе, що ближче за це І майже паралельне, — справжній ризик,
 * а не законний дотик під кутом.
 */
const COPLANAR_DISTANCE = 0.002;
/** cos кута між нормалями, за яким грані вважаються паралельними (≈8°). */
const COPLANAR_COS = 0.99;

/** Канонічний ідентифікатор вершини: шов і осьові точки згорнуті. */
function canonicalVertexId(v: number, profileLen: number, segments: number): number {
  const row = v % profileLen;
  const col = (v - row) / profileLen;
  if (row === 0) return -1; // осьова точка основи — одна на все тіло
  if (row === profileLen - 1) return -2; // осьова точка вістря
  return (col === segments ? 0 : col) * profileLen + row;
}

export function validateTopology(entries: readonly ShellEntry[]): TopologyViolation[] {
  const violations: TopologyViolation[] = [];
  const byKey = new Map(entries.map((e) => [e.solid.key, e]));

  // Кеш світових вершин — знадобиться і для копланарності між тілами.
  const worlds = new Map<string, THREE.Vector3[]>();
  for (const e of entries) worlds.set(e.solid.key, worldVertices(e.geometry, e.solid));

  for (const entry of entries) {
    const { solid, hostKey, geometry } = entry;
    const index = geometry.getIndex();
    if (index === null || index.count === 0) continue;
    const world = worlds.get(solid.key)!;
    const profileLen = solid.profile.points.length;
    const { segments } = solid.profile;

    const triangleCount = index.count / 3;
    const seenFaces = new Set<string>();
    const edgeUse = new Map<string, { a: number; b: number; count: number }>();
    let degenerate = 0;
    let duplicate = 0;

    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    for (let t = 0; t < triangleCount; t++) {
      const i0 = index.getX(t * 3);
      const i1 = index.getX(t * 3 + 1);
      const i2 = index.getX(t * 3 + 2);

      // Площа: половина довжини векторного добутку.
      ab.subVectors(world[i1]!, world[i0]!);
      ac.subVectors(world[i2]!, world[i0]!);
      if (ab.cross(ac).length() * 0.5 < MIN_AREA) degenerate++;

      const canon = [i0, i1, i2].map((v) => canonicalVertexId(v, profileLen, segments));
      const faceId = [...canon].sort((x, y) => x - y).join('_');
      if (seenFaces.has(faceId)) duplicate++;
      else seenFaces.add(faceId);

      for (let e = 0; e < 3; e++) {
        const a = canon[e]!;
        const b = canon[(e + 1) % 3]!;
        if (a === b) continue; // ребро, що виродилось на осі
        const id = a < b ? `${a}_${b}` : `${b}_${a}`;
        const rec = edgeUse.get(id);
        if (rec === undefined) edgeUse.set(id, { a: [i0, i1, i2][e]!, b: [i0, i1, i2][(e + 1) % 3]!, count: 1 });
        else rec.count++;
      }
    }

    if (degenerate > 0) {
      violations.push({
        kind: 'degenerate-face',
        key: solid.key,
        detail: `${degenerate} гран(ей) нульової площі`,
      });
    }
    if (duplicate > 0) {
      violations.push({
        kind: 'duplicate-face',
        key: solid.key,
        detail: `${duplicate} дубльован(их) гран(ей)`,
      });
    }

    // ── `CAI-REQ-006`: відкрита межа лишається схованою в масі ────────
    const host = hostKey === null ? undefined : byKey.get(hostKey)?.solid;
    let exposed = 0;
    for (const { a, b, count } of edgeUse.values()) {
      if (count !== 1) continue; // не межа
      const hidden = (v: number): boolean => {
        if (host !== undefined && isInsideHost(world[v]!, host, breatheMargin(solid, host))) return true;
        // Дірку міг лишити й не-господар (`CAI-REQ-007`) — тоді ховає він.
        for (const other of entries) {
          if (other.solid.key === solid.key) continue;
          if (isInsideHost(world[v]!, other.solid, breatheMargin(solid, other.solid))) return true;
        }
        return false;
      };
      if (!hidden(a) || !hidden(b)) exposed++;
    }
    if (exposed > 0) {
      violations.push({
        kind: 'open-boundary-outside',
        key: solid.key,
        detail: `${exposed} ребер відкритої межі виходять за поверхню маси`,
      });
    }
  }

  violations.push(...findCoplanarOverlaps(entries, worlds));
  violations.sort((a, b) => a.key.localeCompare(b.key) || a.kind.localeCompare(b.kind));
  return violations;
}

/**
 * Пари граней РІЗНИХ тіл, що майже збігаються площиною і стоять упритул —
 * канонічний ризик z-fighting. Це той канал, який ерозія на «дихання»
 * лишає відкритим свідомо: грані в межах запасу не зрізаються, тож треба
 * знати, чи не опинилась якась із них упритул до чужої поверхні.
 */
function findCoplanarOverlaps(
  entries: readonly ShellEntry[],
  worlds: ReadonlyMap<string, THREE.Vector3[]>,
): TopologyViolation[] {
  const violations: TopologyViolation[] = [];
  const centroids = new Map<string, { c: THREE.Vector3; n: THREE.Vector3 }[]>();

  for (const e of entries) {
    const index = e.geometry.getIndex();
    if (index === null || index.count === 0) continue;
    const world = worlds.get(e.solid.key)!;
    const faces: { c: THREE.Vector3; n: THREE.Vector3 }[] = [];
    for (let t = 0; t < index.count / 3; t++) {
      const a = world[index.getX(t * 3)]!;
      const b = world[index.getX(t * 3 + 1)]!;
      const c = world[index.getX(t * 3 + 2)]!;
      const n = new THREE.Vector3()
        .subVectors(b, a)
        .cross(new THREE.Vector3().subVectors(c, a));
      if (n.lengthSq() < 1e-20) continue;
      faces.push({ c: new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3), n: n.normalize() });
    }
    centroids.set(e.solid.key, faces);
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const A = entries[i]!;
      const B = entries[j]!;
      if (!boundsOverlap(A.solid, B.solid)) continue;
      const fa = centroids.get(A.solid.key) ?? [];
      const fb = centroids.get(B.solid.key) ?? [];
      let risky = 0;
      for (const x of fa) {
        for (const y of fb) {
          if (x.c.distanceToSquared(y.c) > COPLANAR_DISTANCE * COPLANAR_DISTANCE) continue;
          if (Math.abs(x.n.dot(y.n)) < COPLANAR_COS) continue;
          risky++;
        }
      }
      if (risky > 0) {
        violations.push({
          kind: 'coplanar-overlap',
          key: A.solid.key,
          detail: `${risky} пар граней упритул і майже паралельно до «${B.solid.key}» (ризик z-fighting)`,
        });
      }
    }
  }
  return violations;
}

export function formatTopologyViolations(violations: readonly TopologyViolation[]): string {
  if (violations.length === 0) return 'topology: 0 порушень';
  return violations.map((v) => `[${v.kind}] ${v.key}: ${v.detail}`).join('\n');
}
