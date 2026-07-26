// ============================================================
// validateShell — валідація зовнішньої оболонки маси (Volume V).
// ------------------------------------------------------------
// Нормативно: CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE §6/§12,
// `CAI-REQ-005..008`, `V5-REQ-016`.
//
// Валідатор навмисно НЕ довіряє звіту junctionTrim: він переперевіряє
// результат по фінальних буферах геометрії. Інакше «перевірка» лише
// повторювала б припущення того самого коду, що робив зріз.
//
// Про гейт публікації. §12 вимагає блокувати публікацію на порушенні; у
// застосунку це означало б показати парі порожній екран замість кристала.
// Тому гейт стоїть НА РІВНІ CI — тести + `npm run build`, — а в рантаймі
// валідатор лише гучно репортує в dev-консоль. Це не «тихий фолбек»
// (спека його забороняє): помилка не ковтається, гейт реальний, просто
// спрацьовує перед деплоєм, а не перед очима користувача. Зафіксовано як
// свідоме відхилення в docs/IMPLEMENTATION_STATUS.md.
// ============================================================
import * as THREE from 'three';
import { boundsOverlap, breatheMargin, isInsideHost, type HostSolid } from './hostBody';
import { triangleInside, worldVertices } from './junctionTrim';

export type ShellViolationKind =
  /** Тіло посилається на господаря, якого немає в опублікованій масі. */
  | 'orphan-host'
  /** Кришка основи повністю занурена в господаря, але лишилась в оболонці. */
  | 'visible-base-cap'
  /** Грань, повністю занурена в чуже тіло, вціліла (`CAI-REQ-007`). */
  | 'internal-face-visible'
  /** Знизу видно ВНУТРІШНІЙ бік оболонки — та сама «діра без текстури». */
  | 'interior-visible-from-outside';

export interface ShellViolation {
  kind: ShellViolationKind;
  key: string;
  hostKey: string | null;
  detail: string;
}

export interface ShellEntry {
  solid: HostSolid;
  hostKey: string | null;
  /** Геометрія ПІСЛЯ зрізу — саме те, що піде в сцену. */
  geometry: THREE.BufferGeometry;
}

const RANK: Record<ShellViolationKind, number> = {
  'orphan-host': 0,
  'visible-base-cap': 1,
  'internal-face-visible': 2,
  'interior-visible-from-outside': 3,
};

/**
 * Статична валідація оболонки: сироти, залишена занурена кришка,
 * уцілілі приховані грані. Порядок результату детермінований (за ключем
 * тіла, потім за видом) — звіт мусить бути відтворюваним, інакше він
 * марний як доказ.
 */
export function validateExternalShell(entries: readonly ShellEntry[]): ShellViolation[] {
  const violations: ShellViolation[] = [];
  const byKey = new Map(entries.map((e) => [e.solid.key, e]));

  for (const entry of entries) {
    const { solid, hostKey, geometry } = entry;

    if (hostKey !== null && !byKey.has(hostKey)) {
      violations.push({
        kind: 'orphan-host',
        key: solid.key,
        hostKey,
        detail: `господаря «${hostKey}» немає в опублікованій масі`,
      });
    }

    const index = geometry.getIndex();
    if (index === null) continue;

    const occluders = entries
      .filter((e) => e.solid.key !== solid.key && boundsOverlap(solid, e.solid))
      .map((e) => e.solid);
    if (occluders.length === 0) continue;

    const world = worldVertices(geometry, solid);
    const triangleCount = index.count / 3;
    const profileLen = solid.profile.points.length;

    // ── `CAI-REQ-007`: жодна грань не сидить цілком у чужому тілі ─────
    let hidden = 0;
    let hiddenIn = '';
    let capFaces = 0;
    for (let t = 0; t < triangleCount; t++) {
      const a = index.getX(t * 3);
      const b = index.getX(t * 3 + 1);
      const c = index.getX(t * 3 + 2);
      if (a % profileLen === 0 || b % profileLen === 0 || c % profileLen === 0) capFaces++;
      for (const o of occluders) {
        if (triangleInside(world[a]!, world[b]!, world[c]!, o, breatheMargin(solid, o))) {
          hidden++;
          if (hiddenIn === '') hiddenIn = o.key;
          break;
        }
      }
    }
    if (hidden > 0) {
      violations.push({
        kind: 'internal-face-visible',
        key: solid.key,
        hostKey,
        detail: `${hidden} гран(ей) цілком усередині «${hiddenIn}» лишились в оболонці`,
      });
    }

    // ── `CAI-REQ-005`: занурена кришка основи не має лишатись ─────────
    const host = hostKey === null ? undefined : byKey.get(hostKey)?.solid;
    if (host !== undefined && capFaces > 0) {
      const margin = breatheMargin(solid, host);
      let ringBuried = true;
      for (let v = 0; v < world.length && ringBuried; v++) {
        if (v % profileLen <= 1 && !isInsideHost(world[v]!, host, margin)) ringBuried = false;
      }
      if (ringBuried) {
        violations.push({
          kind: 'visible-base-cap',
          key: solid.key,
          hostKey,
          detail: 'кільце основи повністю в господарі, але кришка лишилась в оболонці',
        });
      }
    }
  }

  violations.sort((a, b) => a.key.localeCompare(b.key) || RANK[a.kind] - RANK[b.kind]);
  return violations;
}

/**
 * `CAI-REQ-008` — проби знизу (і не лише). Промінь, що йде ззовні в масу,
 * мусить першою зустріти ЗОВНІШНЮ грань. Якщо перше влучання — у виворіт
 * оболонки (нормаль дивиться від камери), значить крізь дірку видно порожнє
 * нутро кристала: рівно те, на що скаржився власник («діра без текстури під
 * кристалом»).
 *
 * Це геометрична проба, не скріншот: результат детермінований і не залежить
 * ні від GPU, ні від освітлення.
 */
export function probeExterior(
  entries: readonly ShellEntry[],
  directions: readonly THREE.Vector3[],
  ringCount = 12,
): ShellViolation[] {
  // DoubleSide обов'язковий: уся суть проби — впіймати влучання у ВИВОРІТ
  // грані, а типовий FrontSide такі влучання просто відкидає.
  const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes: THREE.Mesh[] = entries.map((e) => {
    const mesh = new THREE.Mesh(e.geometry, probeMaterial);
    mesh.position.copy(e.solid.position);
    mesh.quaternion.copy(e.solid.inverseQuaternion).invert();
    mesh.updateMatrixWorld(true);
    mesh.userData.key = e.solid.key;
    mesh.userData.hostKey = e.hostKey;
    return mesh;
  });
  if (meshes.length === 0) return [];

  // Габарит усієї маси — з нього беруться старт променів і крок сітки.
  const bounds = new THREE.Box3();
  for (const entry of entries) {
    bounds.expandByPoint(
      new THREE.Vector3(entry.solid.boundsRadius, entry.solid.boundsRadius, entry.solid.boundsRadius)
        .negate()
        .add(entry.solid.boundsCenter),
    );
    bounds.expandByPoint(
      new THREE.Vector3(entry.solid.boundsRadius, entry.solid.boundsRadius, entry.solid.boundsRadius).add(
        entry.solid.boundsCenter,
      ),
    );
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const span = bounds.getSize(new THREE.Vector3()).length();
  const raycaster = new THREE.Raycaster();

  const violations: ShellViolation[] = [];
  const seen = new Set<string>();
  for (const dir of directions) {
    const direction = dir.clone().normalize();
    // Сітка стартів у площині, перпендикулярній променю: концентричні
    // кільця дають рівномірне покриття силуету без залежності від осей.
    const [u, w] = orthoBasis(direction);
    for (let ring = 0; ring <= 3; ring++) {
      const radius = (ring / 3) * span * 0.35;
      const points = ring === 0 ? 1 : ringCount;
      for (let p = 0; p < points; p++) {
        const angle = (p / points) * Math.PI * 2;
        const origin = center
          .clone()
          .addScaledVector(direction, -span)
          .addScaledVector(u, Math.cos(angle) * radius)
          .addScaledVector(w, Math.sin(angle) * radius);
        raycaster.set(origin, direction);
        const hit = raycaster.intersectObjects(meshes, false)[0];
        if (hit === undefined || hit.face == null) continue;
        // Нормаль грані у світі; додатний скаляр із напрямком променя
        // означає, що ми дивимось граню в спину — це виворіт оболонки.
        const normal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion);
        if (normal.dot(direction) <= 1e-6) continue;
        const key = String(hit.object.userData.key);
        if (seen.has(key)) continue;
        seen.add(key);
        violations.push({
          kind: 'interior-visible-from-outside',
          key,
          hostKey: (hit.object.userData.hostKey as string | null) ?? null,
          detail: `внутрішній бік оболонки видно з напрямку (${fmt(direction.x)}, ${fmt(direction.y)}, ${fmt(direction.z)})`,
        });
      }
    }
  }
  violations.sort((a, b) => a.key.localeCompare(b.key));
  return violations;
}

/** Напрямки проб за замовчуванням: строго знизу + чотири низькі діагоналі. */
export const UNDERSIDE_DIRECTIONS: THREE.Vector3[] = [
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0.6, 1, 0),
  new THREE.Vector3(-0.6, 1, 0),
  new THREE.Vector3(0, 1, 0.6),
  new THREE.Vector3(0, 1, -0.6),
];

function orthoBasis(n: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const seed = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(seed, n).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  return [u, w];
}

const fmt = (v: number): string => v.toFixed(2);

/** Текстовий звіт для dev-консолі й доказів в імплементаційному репорті. */
export function formatShellViolations(violations: readonly ShellViolation[]): string {
  if (violations.length === 0) return 'external shell: 0 порушень';
  return violations
    .map((v) => `[${v.kind}] ${v.key} (host=${v.hostKey ?? '—'}): ${v.detail}`)
    .join('\n');
}
