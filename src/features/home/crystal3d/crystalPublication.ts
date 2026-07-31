// ============================================================
// crystalPublication — єдиний конвеєр публікації кристала.
// ------------------------------------------------------------
// Canonical bodies лишаються повними для trim/shell/topology. Reference
// display crown лише замінює їх у фактичному renderable за тим самим key.
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
  readonly implicitJunction?: ImplicitJunctionStats;
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
  /** Усі canonical логічні тіла, включно з прихованими. */
  readonly bodies: readonly PublishedBody[];
  /** Фактичні видимі логічні key: canonical або їх display-заміна. */
  readonly renderable: readonly PublishedBody[];
  /** Реальний набір сцени. Може бути художньо чистішим за semantic renderable. */
  readonly drawables: readonly PublishedBody[];
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
  skipReferenceLayout?: boolean;
  skipReferenceDisplay?: boolean;
  skipTrim?: boolean;
  skipSeam?: boolean;
  skipFusion?: boolean;
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

const triangleCount = (geometry: THREE.BufferGeometry): number =>
  (geometry.getIndex()?.count ?? 0) / 3;

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
  const activeDisplayKeys = displayResult !== null && displayResult.bodies.length > 0
    ? displayResult.selection.sourceKeys
    : new Set<string>();

  if (referenceBase !== null) {
    // Якщо display оживляє source, який canonical trim уже повністю сховав,
    // компенсуємо це додатковим не-display hidden body. Фінальна економія
    // тому не залежить від того, які саме реальні події стали короною.
    const revived = prepared.filter((body) => (
      activeDisplayKeys.has(body.branch.key) && triangleCount(body.geometry) === 0
    )).length;
    enforceReferenceHiddenBudget(prepared, accentKeys, 4 + revived, activeDisplayKeys);
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

  // Canonical shell не залежить від художнього display-layer.
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

  // Semantic renderable лишається 1:1 з логічними key і використовується
  // метриками/тестами. Canonical source mesh замінюється display-версією
  // лише для того самого key.
  const logicalRenderable = bodies.filter((body) => (
    triangleCount(body.geometry) > 0 && !activeDisplayKeys.has(body.branch.key)
  ));
  const renderable = [...logicalRenderable, ...displayBodies];

  // Коли reference crown активна, випадкові canonical діти й їхні старі
  // implicit-комірці не повинні вдруге з'являтися у кадрі. Для сцени
  // лишаються тільки центральне тіло, прихована матриця/основа й
  // контрольована корона. Canonical оболонка при цьому повністю збережена
  // вище для shell/topology/material-аудиту.
  const hasReferenceDisplay = displayBodies.length > 0;
  const sceneCanonical = hasReferenceDisplay
    ? logicalRenderable.filter((body) => body.branch.primary || body.branch.archetype === 'matrix')
    : logicalRenderable;
  const sceneJunctions = hasReferenceDisplay
    ? junctions.filter((body) => {
        const junction = body.implicitJunction;
        return junction === undefined || (
          !activeDisplayKeys.has(junction.sourceKey)
          && !activeDisplayKeys.has(junction.hostKey)
        );
      })
    : junctions;
  const drawables = [...sceneCanonical, ...displayBodies, ...sceneJunctions];

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
