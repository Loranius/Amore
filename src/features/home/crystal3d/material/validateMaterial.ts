// ============================================================
// validateMaterial — валідація власності матеріалу (Volume VI).
// ------------------------------------------------------------
// Нормативно: CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE §7,
// `CAI-REQ-009..010`, `V6-REQ-013..015`.
//
// Перевіряє три речі, кожна з яких відповідає рядку профілю:
//
//  `unbound-material`   зрізані/внутрішні грані не отримують видимої
//                       прив'язки — вершина поза оболонкою мусить лишатись
//                       без кольору, і жодна вціліла грань не сміє на таку
//                       вершину посилатись;
//  `seam-outside-band`  вершина, позначена як шов, лежить у межах оголошеної
//                       смуги (`CAI-REQ-010`);
//  `blend-outside-seam` поза смугою колір НЕ відрізняється від чистого
//                       власного матеріалу тіла — перехід не «протікає».
//
// Кожна з трьох здатна впасти, і на кожну є тест, що доводить це підробкою
// даних. Це не формальність: валідатор, який не може впасти, дає гіршу за
// відсутність гарантію — зелене світло, що нічого не означає.
//
// Чому тут НЕМАЄ проби «матеріал крізь чужу область» (`CAI-REQ-009`).
// Спроба була, і виявилась структурно вакуумною: промінь ззовні першою
// зустрічає найзовнішнішу поверхню за визначенням, тож вона не може лежати
// всередині іншого тіла — інакше першою була б поверхня того тіла. Замість
// проби-пустушки вимога тримається доказом із двох частин, кожна з яких
// перевірена окремо:
//   1. Volume V: після зрізу геометрія тіла існує ЛИШЕ поза всіма іншими
//      тілами (тест `hidden-face` перебирає кожну грань × кожне тіло);
//   2. Volume VI: матеріал тіла прив'язаний ЛИШЕ до його власних вцілілих
//      граней (`unbound-material` тут).
// Разом: колір тіла може з'явитись у пікселі, лише якщо там видно його
// власну поверхню, а вона не буває в чужому об'ємі.
// ============================================================
import * as THREE from 'three';
import { distanceOutsideHost, type HostSolid } from '../geometry/hostBody';
import { worldVertices } from '../geometry/junctionTrim';
import type { ClusterBranch, ClusterMaterial } from '../crystalCluster';
import { bindMaterialRegions, type MaterialRegion, type MaterialRegionStats } from './crystalMaterial';

export type MaterialViolationKind =
  | 'unbound-material'
  | 'seam-outside-band'
  | 'blend-outside-seam';

export interface MaterialViolation {
  kind: MaterialViolationKind;
  key: string;
  detail: string;
}

export interface MaterialEntry {
  branch: ClusterBranch;
  solid: HostSolid;
  geometry: THREE.BufferGeometry;
}

/** Похибка порівняння кольорів: 8-бітний канал ≈ 1/255. */
const COLOR_EPS = 1 / 512;

export function validateMaterialRegions(
  entries: readonly MaterialEntry[],
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix'>,
): MaterialViolation[] {
  const violations: MaterialViolation[] = [];
  const byKey = new Map(entries.map((e) => [e.branch.key, e]));

  for (const entry of entries) {
    const { branch, solid, geometry } = entry;
    const index = geometry.getIndex();
    const color = geometry.getAttribute('color');
    const regions = geometry.userData.materialRegions as MaterialRegion[] | undefined;
    const stats = geometry.userData.materialStats as MaterialRegionStats | undefined;
    if (index === null || color === undefined || regions === undefined || stats === undefined) {
      violations.push({ kind: 'unbound-material', key: branch.key, detail: 'матеріал не прив’язано' });
      continue;
    }

    // ── прив'язка лише до вцілілих граней ────────────────────────────
    const referenced = new Uint8Array(color.count);
    for (let i = 0; i < index.count; i++) referenced[index.getX(i)] = 1;
    let leaked = 0;
    let starved = 0;
    for (let v = 0; v < color.count; v++) {
      const lit = color.getX(v) !== 0 || color.getY(v) !== 0 || color.getZ(v) !== 0;
      if (referenced[v] === 0 && lit) leaked++;
      if (referenced[v] === 1 && regions[v] === 'unbound') starved++;
    }
    if (leaked > 0 || starved > 0) {
      violations.push({
        kind: 'unbound-material',
        key: branch.key,
        detail: `${leaked} зрізаних вершин з кольором, ${starved} вцілілих без прив’язки`,
      });
    }

    // ── смуга шва: межі та відсутність протікання ────────────────────
    const host = branch.hostKey === null ? undefined : byKey.get(branch.hostKey);
    const world = worldVertices(geometry, solid);
    if (host !== undefined) {
      let outside = 0;
      for (let v = 0; v < color.count; v++) {
        if (regions[v] !== 'seam') continue;
        const d = distanceOutsideHost(world[v]!, host.solid);
        if (d < 0 || d >= stats.blendWidth) outside++;
      }
      if (outside > 0) {
        violations.push({
          kind: 'seam-outside-band',
          key: branch.key,
          detail: `${outside} вершин шва поза смугою ${stats.blendWidth.toFixed(4)}`,
        });
      }
    }

    // Чистий матеріал — той самий код, викликаний БЕЗ господаря. Так
    // перевірка не переписує формулу кольору й не може розійтися з нею.
    const bare = new THREE.BufferGeometry();
    bare.setAttribute('position', geometry.getAttribute('position'));
    bare.setIndex(index);
    bindMaterialRegions(bare, branch, solid, material, undefined);
    const pure = bare.getAttribute('color');
    let drifted = 0;
    for (let v = 0; v < color.count; v++) {
      if (regions[v] !== 'external') continue;
      if (
        Math.abs(color.getX(v) - pure.getX(v)) > COLOR_EPS ||
        Math.abs(color.getY(v) - pure.getY(v)) > COLOR_EPS ||
        Math.abs(color.getZ(v) - pure.getZ(v)) > COLOR_EPS
      ) {
        drifted++;
      }
    }
    if (drifted > 0) {
      violations.push({
        kind: 'blend-outside-seam',
        key: branch.key,
        detail: `${drifted} зовнішніх вершин змінили колір поза смугою шва`,
      });
    }
  }

  violations.sort((a, b) => a.key.localeCompare(b.key) || a.kind.localeCompare(b.kind));
  return violations;
}

export function formatMaterialViolations(violations: readonly MaterialViolation[]): string {
  if (violations.length === 0) return 'material regions: 0 порушень';
  return violations.map((v) => `[${v.kind}] ${v.key}: ${v.detail}`).join('\n');
}
