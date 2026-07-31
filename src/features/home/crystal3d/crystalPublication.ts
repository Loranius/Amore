// ============================================================
// crystalPublication — єдиний конвеєр публікації кристала.
// ------------------------------------------------------------
// Нормативно: Volume V §12 (публікація), Volume VI §11,
// `CAI-REQ-011..012`, `V5-REQ-009/016`, `V6-REQ-010/015`.
//
// Порядок: renderer-layout → renderer-contract → accent → форма → зріз
// стику → reference display crown → hidden budget → матеріал → локальне
// implicit-зрощення → валідація. Growth State лишається незмінним.
// ============================================================
import type * as THREE from 'three';
import { buildBranchGeometry, type ClusterBranch, type ClusterMaterial } from './crystalCluster';
import { buildHostSolids, type HostSolid } from './geometry/hostBody';
import { trimHiddenFaces, type TrimStats } from './geometry/junctionTrim';
import { LOD_LEVELS, type LodLevel } from './geometry/lod';
import {
  ensureVisibleReferenceAccent,
  selectReferenceAccentKeys,
} from './geometry/referenceDruseAccent';
import {
  buildReferenceDisplayCrown,
  type ReferenceDisplaySelection,
} from './geometry/referenceDisplayCrown';
import {
  buildReferenceJunctionBodies,
  type ImplicitJunctionStats,
} from './geometry/referenceJunction';
import { enforceReferenceDruseContract } from './geometry/referenceDruseContract';
import { enforceReferenceHiddenBudget } from './geometry/referenceHiddenBudget';
import { applyReferenceDruseLayout } from './geometry/referenceDruseLayout';
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
  /** Renderer-only display-представлення логічного тіла з тим самим key. */
  readonly referenceDisplay?: 'hero' | 'medium' | 'short';
}

interface PreparedBody {
  readonly branch: ClusterBranch;
  readonly solid: HostSolid;
  readonly geometry: THREE.BufferGeometry;
  readonly trim: TrimStats;
}

export interface PublishedCrystal {
  readonly lod: LodLevel;
  /** Усі логічні тіла стану, включно з повністю прихованими. */
  readonly bodies: readonly PublishedBody[];
  /** Видимі логічні тіла, включно з renderer-only представленнями тих самих key. */
  readonly renderable: readonly PublishedBody[];
  /** Фактичний набір рендера: renderable + bounded implicit collars. */
  readonly drawables: readonly PublishedBody[];
  /** Контрольовані renderer-only hero та базальна корона. */
  readonly displayBodies: readonly PublishedBody[];
  readonly displaySelection: ReferenceDisplaySelection | null;
  readonly junctions: readonly PublishedBody[];
  readonly shellViolations: readonly ShellViolation[];
  readonly materialViolations: readonly MaterialViolation[];
  readonly topologyViolations: readonly TopologyViolation[];
  readonly ok: boolean;
}

export interface PublishOptions {
  lod?: LodLevel;
  /** Пропустити renderer-layout — лише для A/B та доказу межі шарів. */
  skipReferenceLayout?: boolean;
  /** Пропустити контрольований display crown — A/B візуальної композиції. */
  skipReferenceDisplay?: boolean;
  /** Пропустити зріз стику — лише для доказів «валідатор не вакуумний». */
  skipTrim?: boolean;
  /** Пропустити смугу шва — before/after для `CAI-REQ-010`. */
  skipSeam?: boolean;
  /** Пропустити implicit collars — A/B і falsifiability-тести Phase 3B-2. */
  skipFusion?: boolean;
  /** Проби променями коштують помітно дорожче за статичну валідацію. */
  probe?: boolean;
}

const emptyTrim = (branch: ClusterBranch, geometry: THREE.BufferGeometry): TrimStats => ({
  key: branch.key,
  hostKey: branch.hostKey,
  trianglesTotal: (geometry.getIndex()?.count ?? 0) / 3,
  trianglesRemoved: 0,
  capBuried: false,
  capRemoved: false,
  occluders: [],
});

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
  const referenceBase = options.skipReferenceLayout
    ? null
    : enforceReferenceDruseContract(applyReferenceDruseLayout(branches));
  const accentKeys = referenceBase === null
    ? new Set<string>()
    : selectReferenceAccentKeys(referenceBase);
  const laidOut = referenceBase === null
    ? branches.map((branch) => ({ ...branch }))
    : ensureVisibleReferenceAccent(referenceBase);
  const solids = buildHostSolids(laidOut, material, lod);
  const byKey = new Map(laidOut.map((branch) => [branch.key, branch] as const));

  const prepared: PreparedBody[] = laidOut.map((branch) => {
    const solid = solids.get(branch.key)!;
    const geometry = buildBranchGeometry(branch, material, lod);

    const trim = options.skipTrim
      ? emptyTrim(branch, geometry)
      : trimHiddenFaces(geometry, solid, branch.hostKey, solids);

    return { branch, solid, geometry, trim };
  });

  const displayResult = referenceBase === null || options.skipReferenceDisplay === true
    ? null
    : buildReferenceDisplayCrown(laidOut, material, lod, accentKeys);
  if (displayResult !== null) {
    // Старий mesh події лишається в `bodies`, але не потрапляє в renderer.
    // Display-body нижче має той самий key, тому tap/модалка/метрики бачать
    // ту саму логічну подію, а не новий synthetic ID.
    for (const body of prepared) {
      if (displayResult.selection.sourceKeys.has(body.branch.key)) {
        body.geometry.setIndex([]);
      }
    }
  }

  if (referenceBase !== null) {
    enforceReferenceHiddenBudget(prepared, accentKeys);
  }

  const bodies: PublishedBody[] = prepared.map(({ branch, solid, geometry, trim }) => {
    const hostSolid = branch.hostKey === null ? undefined : solids.get(branch.hostKey);
    const hostBranch = branch.hostKey === null ? undefined : byKey.get(branch.hostKey);
    const host =
      !options.skipSeam && hostSolid !== undefined && hostBranch !== undefined
        ? { solid: hostSolid, branch: hostBranch }
        : undefined;
    const materialStats = bindMaterialRegions(geometry, branch, solid, material, host);
    return { branch, solid, geometry, trim, material: materialStats };
  });

  const displayBodies: PublishedBody[] = (displayResult?.bodies ?? []).map((display) => ({
    branch: display.branch,
    solid: display.solid,
    geometry: display.geometry,
    trim: emptyTrim(display.branch, display.geometry),
    material: display.material,
    referenceDisplay: display.kind,
  }));

  const implicit = options.skipFusion
    ? []
    : buildReferenceJunctionBodies(laidOut, solids, lod);
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

  // Shell/topology перевіряють канонічні логічні тіла. Display crown є
  // заміною renderer-представлення вже перевірених ключів і не бере участі
  // у trim/host-математиці, аналогічно bounded implicit collars.
  const shellEntries = bodies.map((body) => ({
    solid: body.solid,
    hostKey: body.branch.hostKey,
    geometry: body.geometry,
  }));
  const shellViolations = [
    ...validateExternalShell(shellEntries),
    ...(options.probe === true ? probeExterior(shellEntries, UNDERSIDE_DIRECTIONS) : []),
  ];
  const materialViolations = validateMaterialRegions(
    [...bodies, ...displayBodies, ...junctions],
    material,
  );
  const topologyViolations = validateTopology(shellEntries);
  const logicalRenderable = bodies.filter((body) => (body.geometry.getIndex()?.count ?? 0) > 0);
  const renderable = [...logicalRenderable, ...displayBodies];
  const drawables = [...renderable, ...junctions];

  return Object.freeze({
    lod,
    bodies: Object.freeze(bodies),
    renderable: Object.freeze(renderable),
    drawables: Object.freeze(drawables),
    displayBodies: Object.freeze(displayBodies),
    displaySelection: displayResult?.selection ?? null,
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

export function formatPublicationReport(published: PublishedCrystal): string {
  const lines = [
    `LOD ${published.lod}: ${published.bodies.length} тіл, ${published.displayBodies.length} display, ${published.junctions.length} implicit-стиків`,
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

export function publishAllLods(
  branches: readonly ClusterBranch[],
  material: ClusterMaterial,
  options: Omit<PublishOptions, 'lod'> = {},
): PublishedCrystal[] {
  return LOD_LEVELS.map((lod) => publishCrystal(branches, material, { ...options, lod }));
}
