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

/**
 * Чи бачить промінь ВИВОРІТ оболонки першим — із захистом від виродженого
 * влучання.
 *
 * Навіщо захист. Лате ставить вершину колонки 0 рівно на вісь Z (x=0), а
 * канонічні напрямки проб містять точні осі — тож промінь може піти точно
 * вздовж ребра меша. У цьому випадку обидва суміжні трикутники не
 * зараховують влучання (класичне ребро в ray-triangle), промінь «проходить
 * крізь» передню стінку і першим бачить задню. Це артефакт проби, а не
 * дірка: перевірка кількості перетинів показує 1 замість 2.
 *
 * Захист — підтвердження двома ледь зсунутими променями: артефакт ребра
 * зникає від найменшого зсуву (сусідній промінь нормально влучає в передню
 * стінку), а справжня дірка лишається видимою з усіх трьох.
 *
 * Спершу я додав був ще й перевірку парності перетинів (замкнене тіло
 * перетинається парну кількість разів). Її довелось прибрати: відкрита
 * оболонка дає непарну кількість ЗАКОНОМІРНО — і це рівно той дефект, який
 * проба має ловити. Правило відсіювало саме знахідки, заради яких існує.
 */
function seesInterior(
  raycaster: THREE.Raycaster,
  meshes: readonly THREE.Mesh[],
  origin: THREE.Vector3,
  direction: THREE.Vector3,
): THREE.Intersection | null {
  const cast = (o: THREE.Vector3): THREE.Intersection | null => {
    raycaster.set(o, direction);
    const hits = raycaster.intersectObjects(meshes as THREE.Mesh[], false);
    const first = hits[0];
    if (first === undefined || first.face == null) return null;
    const normal = first.face.normal.clone().applyQuaternion(first.object.quaternion);
    return normal.dot(direction) > 1e-6 ? first : null;
  };

  const primary = cast(origin);
  if (primary === null) return null;

  // Підтвердження: зсув на частку розміру тіла в двох незалежних напрямках.
  const [u, w] = orthoBasis(direction);
  const eps = 1e-4;
  let confirmed = 0;
  for (const shift of [u.clone().multiplyScalar(eps), w.clone().multiplyScalar(eps)]) {
    if (cast(origin.clone().add(shift)) !== null) confirmed++;
  }
  return confirmed === 2 ? primary : null;
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
        const hit = seesInterior(raycaster, meshes, origin, direction);
        if (hit === null) continue;
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

/** Напрямки проб знизу: строго знизу + чотири низькі діагоналі. */
export const UNDERSIDE_DIRECTIONS: THREE.Vector3[] = [
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0.6, 1, 0),
  new THREE.Vector3(-0.6, 1, 0),
  new THREE.Vector3(0, 1, 0.6),
  new THREE.Vector3(0, 1, -0.6),
];

/** Повний оберт навколо колонії — 16 горизонтальних напрямків (§8). */
export const ORBIT_DIRECTIONS: THREE.Vector3[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
});

/** Строго згори (§8). */
export const TOP_DIRECTION = new THREE.Vector3(0, -1, 0);

/** Похилі згори — між орбітою й видом згори лишалась би сліпа зона. */
const UPPER_OBLIQUE: THREE.Vector3[] = [
  new THREE.Vector3(0.7, -1, 0),
  new THREE.Vector3(-0.7, -1, 0),
  new THREE.Vector3(0, -1, 0.7),
  new THREE.Vector3(0, -1, -0.7),
];

/**
 * Уся матриця видів §8 одним набором: оберт + верх + похилі згори + низ.
 * Тримається тут, а не в тестах, щоб «повний набір видів» мав одне
 * визначення — інакше кожен тест перевіряв би свою частину й ніхто не
 * відповідав би за покриття цілком.
 */
export const VALIDATION_VIEWS: THREE.Vector3[] = [
  ...ORBIT_DIRECTIONS,
  TOP_DIRECTION,
  ...UPPER_OBLIQUE,
  ...UNDERSIDE_DIRECTIONS,
];

/**
 * `CAI-REQ-008`, близькі види стиків (§8: «close-up views of every high-risk
 * junction» + «side views at junction height»).
 *
 * Навіщо окремо від `probeExterior`. Глобальна проба стріляє сіткою по
 * силуету всієї маси — на 58 тіл це десятки променів на весь кристал, і
 * дефект розміром з один стик вона може просто не зачепити. Тут навпаки:
 * для КОЖНОЇ пари господар↔дитина промені йдуть щільною сферою прямо в
 * точку виходу дитини з господаря. Саме там і живуть ризики: зрізана
 * кришка, шов, майже дотичні поверхні.
 *
 * Перше влучання не має бути виворотом грані — критерій той самий, що в
 * `probeExterior`, бо питання те саме: чи не видно нутро оболонки.
 */
export function probeJunctions(
  entries: readonly ShellEntry[],
  ringCount = 8,
): ShellViolation[] {
  const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = entries.map((e) => {
    const mesh = new THREE.Mesh(e.geometry, probeMaterial);
    mesh.position.copy(e.solid.position);
    mesh.quaternion.copy(e.solid.inverseQuaternion).invert();
    mesh.updateMatrixWorld(true);
    mesh.userData.key = e.solid.key;
    return mesh;
  });
  const byKey = new Map(entries.map((e) => [e.solid.key, e]));
  const raycaster = new THREE.Raycaster();
  const violations: ShellViolation[] = [];
  const seen = new Set<string>();

  // Габарит УСІЄЇ маси. Стартувати промінь на фіксованій невеликій відстані
  // від стику не можна: стик лежить на поверхні господаря, тож для напрямків
  // «усередину» такий старт опинявся б у тілі господаря, і проба звітувала б
  // про виворіт там, де насправді просто дивиться зсередини назовні. Тому
  // промені завжди починаються ЗА межами маси, лише прицілені в стик.
  const center = new THREE.Vector3();
  for (const e of entries) center.add(e.solid.boundsCenter);
  if (entries.length > 0) center.multiplyScalar(1 / entries.length);
  let massRadius = 0;
  for (const e of entries) {
    massRadius = Math.max(massRadius, center.distanceTo(e.solid.boundsCenter) + e.solid.boundsRadius);
  }

  for (const entry of entries) {
    const { hostKey, solid } = entry;
    if (hostKey === null) continue;
    const host = byKey.get(hostKey)?.solid;
    if (host === undefined) continue;

    // Ціль — основа дитини, тобто точка її виходу з господаря.
    const target = solid.position.clone();
    const start = massRadius + center.distanceTo(target) + Math.max(solid.profile.h, host.profile.h);

    for (let ring = 0; ring < ringCount; ring++) {
      const phi = ((ring + 0.5) / ringCount) * Math.PI; // полярний кут
      const slices = Math.max(4, Math.round(Math.sin(phi) * ringCount * 2));
      for (let s = 0; s < slices; s++) {
        const theta = (s / slices) * Math.PI * 2;
        const dir = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        );
        // Старт поза масою, напрямок — точно в стик.
        const inward = dir.clone().negate();
        const hit = seesInterior(raycaster, meshes, target.clone().addScaledVector(dir, start), inward);
        if (hit === null) continue;
        const key = String(hit.object.userData.key);
        const id = `${solid.key}@${key}`;
        if (seen.has(id)) continue;
        seen.add(id);
        violations.push({
          kind: 'interior-visible-from-outside',
          key,
          hostKey: byKey.get(key)?.hostKey ?? null,
          detail: `виворіт оболонки видно зблизька біля стику ${hostKey}→${solid.key}`,
        });
      }
    }
  }
  violations.sort((a, b) => a.key.localeCompare(b.key) || a.detail.localeCompare(b.detail));
  return violations;
}

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
