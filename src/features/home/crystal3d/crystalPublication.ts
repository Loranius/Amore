// ============================================================
// crystalPublication — єдиний конвеєр публікації кристала.
// ------------------------------------------------------------
// Нормативно: Volume V §12 (публікація), Volume VI §11,
// `CAI-REQ-011..012`, `V5-REQ-009/016`, `V6-REQ-010/015`.
//
// Порядок незмінний: форма → зріз стику → локальне implicit-зрощення →
// матеріал → валідація. Marching Cubes працює лише один раз під час
// публікації та лише в обмежених зонах найбільших базальних стиків.
// ============================================================
import type * as THREE from 'three';
import { buildBranchGeometry, type ClusterBranch, type ClusterMaterial } from './crystalCluster';
import { buildHostSolids, type HostSolid } from './geometry/hostBody';
import {
  buildImplicitJunctionBodies,
  type ImplicitJunctionStats,
} from './geometry/implicitJunction';
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
  /** Є лише в synthetic collar, логічним тілом Growth Engine не є. */
  readonly implicitJunction?: ImplicitJunctionStats;
}

export interface PublishedCrystal {
  readonly lod: LodLevel;
  /** Усі логічні тіла стану, включно з повністю прихованими. */
  readonly bodies: readonly PublishedBody[];
  /** Видимі логічні тіла; семантика метрик/історії лишається незмінною. */
  readonly renderable: readonly PublishedBody[];
  /** Фактичний набір рендера: видимі тіла + bounded implicit collars. */
  readonly drawables: readonly PublishedBody[];
  readonly junctions: readonly PublishedBody[];
  readonly shellViolations: readonly ShellViolation[];
  readonly materialViolations: readonly MaterialViolation[];
  readonly topologyViolations: readonly TopologyViolation[];
  readonly ok: boolean;
}

export interface PublishOptions {
  lod?: LodLevel;
  /** Пропустити зріз стику — лише для доказів «валідатор не вакуумний». */
  skipTrim?: boolean;
  /** Пропустити смугу шва — before/after для `CAI-REQ-010`. */
  skipSeam?: boolean;
  /** Пропустити implicit collars — A/B і falsifiability-тести Phase 3B-2. */
  skipFusion?: boolean;
  /** Проби променями коштують помітно дорожче за статичну валідацію. */
  probe?: boolean;
}

/**
 * Будує і валідує повний стан кристала на заданому рівні деталізації.
 * Чиста функція від (branches, material, options) — жодного стану/часу.
 */
export function publishCrystal(
  branches: readonly ClusterBranch[],
  material: ClusterMaterial,
  options: PublishOptions = {},
): PublishedCrystal {
  const lod = options.lod ?? 'high';
  const solids = buildHostSolids(branches, material, lod);
  const byKey = new Map(branches.map((branch) => [branch.key, branch] as const));

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

    // 2. Volume VI — матеріал СТРОГО після зрізу.
    const hostSolid = branch.hostKey === null ? undefined : solids.get(branch.hostKey);
    const hostBranch = branch.hostKey === null ? undefined : byKey.get(branch.hostKey);
    const host =
      !options.skipSeam && hostSolid !== undefined && hostBranch !== undefined
        ? { solid: hostSolid, branch: hostBranch }
        : undefined;
    const materialStats = bindMaterialRegions(geometry, branch, solid, material, host);

    return { branch, solid, geometry, trim, material: materialStats };
  });

  // 3. Phase 3B-2 — локальна smooth-union оболонка стику. Вона не додає
  // подій/тіл у Growth State: це renderer-only зовнішня мінеральна шкіра.
  const implicit = options.skipFusion
    ? []
    : buildImplicitJunctionBodies(branches, solids, lod);
  const junctions: PublishedBody[] = implicit.flatMap((junction) => {
    const hostSolid = junction.branch.hostKey === null
      ? undefined
      : solids.get(junction.branch.hostKey);
    const hostBranch = junction.branch.hostKey === null
      ? undefined
      : byKey.get(junction.branch.hostKey);
    if (hostSolid === undefined || hostBranch === undefined) {
      junction.geometry.dispose();
      return [];
    }

    const materialStats = bindMaterialRegions(
      junction.geometry,
      junction.branch,
      junction.solid,
      material,
      options.skipSeam ? undefined : { solid: hostSolid, branch: hostBranch },
    );
    const trim: TrimStats = {
      key: junction.branch.key,
      hostKey: junction.branch.hostKey,
      trianglesTotal: junction.stats.trianglesGenerated,
      trianglesRemoved: junction.stats.trianglesGenerated - junction.stats.trianglesKept,
      capBuried: false,
      capRemoved: false,
      occluders: [junction.stats.sourceKey, junction.stats.hostKey].sort(),
    };
    return [{
      branch: junction.branch,
      solid: junction.solid,
      geometry: junction.geometry,
      trim,
      material: materialStats,
      implicitJunction: junction.stats,
    }];
  });

  // 4. Канонічні shell/topology перевірки лишаються на логічних lathe-
  // тілах: їхні валідатори свідомо використовують col·profileLen+row.
  // Implicit collar має власну boundary-перевірку перед поверненням модуля.
  const shellEntries = bodies.map((body) => ({
    solid: body.solid,
    hostKey: body.branch.hostKey,
    geometry: body.geometry,
  }));
  const shellViolations = [
    ...validateExternalShell(shellEntries),
    ...(options.probe === true ? probeExterior(shellEntries, UNDERSIDE_DIRECTIONS) : []),
  ];
  const materialViolations = validateMaterialRegions([...bodies, ...junctions], material);
  const topologyViolations = validateTopology(shellEntries);
  const renderable = bodies.filter((body) => (body.geometry.getIndex()?.count ?? 0) > 0);
  const drawables = [...renderable, ...junctions];

  return Object.freeze({
    lod,
    bodies: Object.freeze(bodies),
    renderable: Object.freeze(renderable),
    drawables: Object.freeze(drawables),
    junctions: Object.freeze(junctions),
    shellViolations: Object.freeze(shellViolations),
    materialViolations: Object.freeze(materialViolations),
    topologyViolations: Object.freeze(topologyViolations),
    ok:
      shellViolations.length === 0
      && materialViolations.length === 0
      && topologyViolations.length === 0,
  });
}

/** Читабельний звіт гейта — для dev-консолі й доказів у репорті. */
export function formatPublicationReport(published: PublishedCrystal): string {
  const lines = [
    `LOD ${published.lod}: ${published.bodies.length} тіл, ${published.junctions.length} implicit-стиків`,
  ];
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
