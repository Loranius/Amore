// ============================================================
// crystalPublication — єдиний конвеєр публікації кристала.
// ------------------------------------------------------------
// Нормативно: Volume V §12 (публікація), Volume VI §11,
// `CAI-REQ-011..012`, `V5-REQ-009/016`, `V6-REQ-010/015`.
//
// Причина існування модуля буденна, але важлива: послідовність
// «профіль → лате → зріз стику → прив'язка матеріалу → валідація» встигла
// розповзтись по трьох місцях (сцена, тестова фікстура, dev-харнес). Три
// копії одного порядку — це три способи розійтись, а порядок тут не
// косметичний: матеріал МУСИТЬ прив'язуватись після зрізу (§7), інакше
// зрізані грані отримають видиму прив'язку. Тепер порядок один і живе тут.
//
// Гейт публікації (`CAI-REQ-012`). Профіль вимагає, щоб провал валідації
// не давав опублікувати нову GeometryState/MaterialState. `publishCrystal`
// повертає `ok: false` і повний перелік порушень — рішення, що з цим
// робити, ухвалює викликач:
//   • тести й `npm run build` — падають (це і є справжній гейт);
//   • рантайм — рендерить попри це й гучно репортує в dev-консоль, бо
//     порожній екран замість кристала гірший за перетин.
// Свідоме відхилення від букви §12, зафіксоване в IMPLEMENTATION_STATUS.md.
// ============================================================
import type * as THREE from 'three';
import { buildBranchGeometry, type ClusterBranch, type ClusterMaterial } from './crystalCluster';
import { buildHostSolids, type HostSolid } from './geometry/hostBody';
import { trimHiddenFaces, type TrimStats } from './geometry/junctionTrim';
import { LOD_LEVELS, type LodLevel } from './geometry/lod';
import {
  formatShellViolations,
  probeExterior,
  UNDERSIDE_DIRECTIONS,
  validateExternalShell,
  type ShellViolation,
} from './geometry/validateShell';
import {
  formatTopologyViolations,
  validateTopology,
  type TopologyViolation,
} from './geometry/validateTopology';
import { bindMaterialRegions, type MaterialRegionStats } from './material/crystalMaterial';
import {
  formatMaterialViolations,
  validateMaterialRegions,
  type MaterialViolation,
} from './material/validateMaterial';

export interface PublishedBody {
  readonly branch: ClusterBranch;
  readonly solid: HostSolid;
  readonly geometry: THREE.BufferGeometry;
  readonly trim: TrimStats;
  readonly material: MaterialRegionStats;
}

export interface PublishedCrystal {
  readonly lod: LodLevel;
  /** Усі тіла стану — зокрема й повністю приховані. Саме цей набір несе
   *  кріплення, тож викидати з нього нічого не можна (`CAI-REQ-004`). */
  readonly bodies: readonly PublishedBody[];
  /**
   * Тіла, які справді треба малювати. Після зрізу частина тіл лишається
   * БЕЗ жодного трикутника — вони цілком поховані в сусідах. Як стан вони
   * потрібні (на них тримаються кріплення), як мешi — ні: порожній меш усе
   * одно коштує draw call і матеріал. На реальній масі це 6–14 тіл із
   * 37–48, тобто до 29% draw calls нізащо. Вузьке місце мобільного GPU тут
   * саме draw calls, тож це найдешевший реальний виграш у всій фазі.
   */
  readonly renderable: readonly PublishedBody[];
  readonly shellViolations: readonly ShellViolation[];
  readonly materialViolations: readonly MaterialViolation[];
  readonly topologyViolations: readonly TopologyViolation[];
  /** true — стан пройшов валідацію і його дозволено публікувати. */
  readonly ok: boolean;
}

export interface PublishOptions {
  lod?: LodLevel;
  /** Пропустити зріз стику — лише для доказів «валідатор не вакуумний». */
  skipTrim?: boolean;
  /** Пропустити смугу шва — before/after для `CAI-REQ-010`. */
  skipSeam?: boolean;
  /** Проби променями коштують помітно дорожче за статичну валідацію. */
  probe?: boolean;
}

/**
 * Будує і валідує повний стан кристала на заданому рівні деталізації.
 * Чиста функція від (branches, material, options) — жодного стану, жодного
 * часу; двічі викликана, дає побайтово той самий результат.
 */
export function publishCrystal(
  branches: readonly ClusterBranch[],
  material: ClusterMaterial,
  options: PublishOptions = {},
): PublishedCrystal {
  const lod = options.lod ?? 'high';
  const solids = buildHostSolids(branches, material, lod);
  const byKey = new Map(branches.map((b) => [b.key, b]));

  const bodies: PublishedBody[] = branches.map((branch) => {
    const solid = solids.get(branch.key)!;
    const geometry = buildBranchGeometry(branch, material, lod);

    // 1. Volume V — зовнішня оболонка: знімаємо приховані грані.
    const trim = options.skipTrim
      ? ({
          key: branch.key,
          hostKey: branch.hostKey,
          trianglesTotal: (geometry.getIndex()?.count ?? 0) / 3,
          trianglesRemoved: 0,
          capBuried: false,
          capRemoved: false,
          occluders: [],
        } satisfies TrimStats)
      : trimHiddenFaces(geometry, solid, branch.hostKey, solids);

    // 2. Volume VI — прив'язка матеріалу СТРОГО після зрізу.
    const hostSolid = branch.hostKey === null ? undefined : solids.get(branch.hostKey);
    const hostBranch = branch.hostKey === null ? undefined : byKey.get(branch.hostKey);
    const host =
      !options.skipSeam && hostSolid !== undefined && hostBranch !== undefined
        ? { solid: hostSolid, branch: hostBranch }
        : undefined;
    const materialStats = bindMaterialRegions(geometry, branch, solid, material, host);

    return { branch, solid, geometry, trim, material: materialStats };
  });

  // 3. Валідація перед публікацією.
  const shellEntries = bodies.map((b) => ({
    solid: b.solid,
    hostKey: b.branch.hostKey,
    geometry: b.geometry,
  }));
  const shellViolations = [
    ...validateExternalShell(shellEntries),
    ...(options.probe === true ? probeExterior(shellEntries, UNDERSIDE_DIRECTIONS) : []),
  ];
  const materialViolations = validateMaterialRegions(bodies, material);
  const topologyViolations = validateTopology(shellEntries);

  // Опублікований стан незмінний (`V6-REQ-010`): сам запис заморожується.
  // Буфери геометрії заморозити не можна — це типізовані масиви GPU, —
  // тож незмінність тримається на тому, що після цієї точки їх ніхто не
  // редагує, а не на рантайм-забороні. Кажу прямо, бо це різні гарантії.
  return Object.freeze({
    lod,
    bodies: Object.freeze(bodies),
    renderable: Object.freeze(bodies.filter((b) => (b.geometry.getIndex()?.count ?? 0) > 0)),
    shellViolations: Object.freeze(shellViolations),
    materialViolations: Object.freeze(materialViolations),
    topologyViolations: Object.freeze(topologyViolations),
    ok:
      shellViolations.length === 0 &&
      materialViolations.length === 0 &&
      topologyViolations.length === 0,
  });
}

/** Читабельний звіт гейта — для dev-консолі й доказів у репорті. */
export function formatPublicationReport(published: PublishedCrystal): string {
  const lines = [`LOD ${published.lod}: ${published.bodies.length} тіл`];
  if (published.shellViolations.length > 0) lines.push(formatShellViolations(published.shellViolations));
  if (published.materialViolations.length > 0) {
    lines.push(formatMaterialViolations(published.materialViolations));
  }
  if (published.topologyViolations.length > 0) {
    lines.push(formatTopologyViolations(published.topologyViolations));
  }
  if (published.ok) lines.push('гейт публікації: пройдено');
  return lines.join('\n');
}

/** Усі публіковані рівні — вхід для перевірки `CAI-REQ-011`. */
export function publishAllLods(
  branches: readonly ClusterBranch[],
  material: ClusterMaterial,
  options: Omit<PublishOptions, 'lod'> = {},
): PublishedCrystal[] {
  return LOD_LEVELS.map((lod) => publishCrystal(branches, material, { ...options, lod }));
}
