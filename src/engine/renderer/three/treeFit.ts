import type { TreeCanopyDepthState } from '../../canopyDepth';
import type { TreeCrownSilhouetteState } from '../../crownSilhouette';
import type { TreeGroundDetailState } from '../../groundDetail';
import type { OrganicSweepMesh } from '../../labs/organic';
import type { TreeLeafGeometryState } from '../../leafGeometry';
import { ARTIFACT_FIT_WIDTH, CRYSTAL_GROUND_BASELINE } from './bundle';

/**
 * What the tree measures, in its own engine units.
 *
 * Split into two horizontal reaches on purpose, and for the same reason the
 * crystal splits its own (`crystalSceneRadius`, `includeSubstrate`): the podium
 * has to cover the ground the tree stands on, while the camera only has to
 * frame the tree itself. Feeding one number to both put a podium under the
 * canopy's shadow and nothing under the soil.
 */
export interface ThreeTreeReach {
  /** Lowest engine y drawn — the soil dips below the tree's own ground plane. */
  minY: number;
  /** Highest engine y drawn, leaf blades included. */
  maxY: number;
  /** How far trunk and crown reach from the trunk's axis. */
  crownReach: number;
  /** How far the soil disc and its litter reach from the trunk's axis. */
  soilReach: number;
}

/**
 * Exactly what the fit reads, and no more.
 *
 * Declared as the parts rather than as the four published states so the fit
 * states its own dependencies: it needs two vertex buffers and two instance
 * lists, not twenty fields of diagnostics. The real states satisfy it as they
 * are, and a test can build one without standing up the whole pipeline.
 */
export interface ThreeTreeFitContent {
  mesh: Pick<OrganicSweepMesh, 'positions'>;
  rootGeometry: { mesh: Pick<OrganicSweepMesh, 'positions'> };
  leaves: Pick<TreeLeafGeometryState, 'instances'>;
  /** Same profile lists the instanced mesh builds its matrices from. */
  canopyDepth: Pick<TreeCanopyDepthState, 'profiles'>;
  crownSilhouette: Pick<TreeCrownSilhouetteState, 'profiles'>;
  groundDetails: Pick<TreeGroundDetailState, 'instances'>;
}

export interface ThreeTreeFit {
  /** Uniform scale from engine units to scene units. */
  scale: number;
  /**
   * Scene y for the tree's group.
   *
   * Chosen so the *lowest drawn point* lands on the portal's floor line, not so
   * the tree's own ground plane does. The two are not the same: the tree digs
   * its terrain disc below engine y=0 (about 0.1 units on the current fixture),
   * and anchoring y=0 to the floor buried the entire disc inside the podium's
   * stone. The roots are meshed to merge into that disc, so with it gone they
   * ended as flat spikes lying on bare rock.
   */
  groundY: number;
  /** Height of the fitted tree in scene units — see `TREE_FIT_HEIGHT`. */
  height: number;
  /** Crown radius in scene units — what the camera frames. */
  crownRadius: number;
  /** Soil radius in scene units — what the podium covers. */
  soilRadius: number;
  /**
   * How far the tree's own ground plane ends up above the floor line, in scene
   * units. Diagnostic: it is exactly the depth of the terrain dish, and a zero
   * here would mean the tree published no soil to stand its roots in.
   */
  groundPlaneLift: number;
}

function reachOf(positions: readonly number[]): {
  minY: number;
  maxY: number;
  reach: number;
} {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let reach = 0;
  for (let offset = 0; offset + 2 < positions.length; offset += 3) {
    const y = positions[offset + 1] ?? 0;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    reach = Math.max(reach, Math.hypot(positions[offset] ?? 0, positions[offset + 2] ?? 0));
  }
  return {
    minY: Number.isFinite(minY) ? minY : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0,
    reach,
  };
}

/**
 * Measures the drawn tree, in engine units.
 *
 * Leaves and ground litter are instanced, so their extent is not in any vertex
 * buffer: the buffers hold one shared card and one shared chip, and where those
 * land is in the instance list. Measuring the buffers alone reported a tree
 * that stopped at the top of its trunk — and since the fit scales by height,
 * that put the entire canopy above the frame.
 *
 * A leaf card is anchored at its base and extends `length` along its own
 * direction, so the anchor plus the length bounds it from any angle. That
 * over-estimates a leaf pointing sideways, which is the harmless direction to
 * be wrong in.
 *
 * Where a leaf lands and how big it draws is *not* what the leaf instance says.
 * Canopy depth and crown silhouette both republish a position and a scale, and
 * the instanced mesh takes the silhouette's first, then the canopy's, then the
 * instance's — so the leaf list alone describes a crown the renderer never
 * draws. Reading it as if it did understated the crown by about a fifth, the
 * camera framed the smaller one, and the outer leaves were cut off by the sides
 * of the screen. The order below is the one in `leafInstances.ts`, and it has
 * to stay that way.
 */
export function measureThreeTreeReach(content: ThreeTreeFitContent): ThreeTreeReach {
  const branches = reachOf(content.mesh.positions);
  const roots = reachOf(content.rootGeometry.mesh.positions);

  let minY = Math.min(branches.minY, roots.minY);
  let maxY = Math.max(branches.maxY, roots.maxY);
  let crownReach = branches.reach;
  for (const leaf of content.leaves.instances) {
    // Keyed on `sequence`, exactly as the instanced mesh keys its matrices —
    // not on the position in the array.
    const canopy = content.canopyDepth.profiles[leaf.sequence];
    const silhouette = content.crownSilhouette.profiles[leaf.sequence];
    const position = silhouette?.renderPosition ?? canopy?.renderPosition ?? leaf.position;
    const length = leaf.length
      * (canopy?.scaleMultiplier ?? 1)
      * (silhouette?.scaleMultiplier ?? 1);
    const radial = Math.hypot(position.x, position.z) + length;
    if (radial > crownReach) crownReach = radial;
    const top = position.y + length;
    if (top > maxY) maxY = top;
    const bottom = position.y - length;
    if (bottom < minY) minY = bottom;
  }

  let soilReach = roots.reach;
  for (const detail of content.groundDetails.instances) {
    soilReach = Math.max(soilReach, Math.hypot(detail.position.x, detail.position.z));
    minY = Math.min(minY, detail.position.y);
  }

  return { minY, maxY, crownReach, soilReach };
}

/**
 * Висота, під яку підганяється ДОРОСЛЕ дерево.
 *
 * Раніше під неї підганялось будь-яке: правило було `min(2.7/height, …)`,
 * тобто масштаб щоразу дотягував дерево до тих самих 2.7. Тоді це було
 * чесно — розмір дерева не залежав від віку взагалі (виміряно на тому
 * самому конвеєрі: 4.97, 5.10, 5.23, 5.00 і 5.25 одиниць на 1, 3, 5, 10 і
 * 20 роках), і крива росту в підгонці була б вигаданою, а не виведеною.
 *
 * Тепер дерево справді росте (`species/tree/growthLaw.ts`), тож підгонка
 * стала ЕТАЛОННОЮ, як у кристала: дорослі 40 років дають 2.7, а росток
 * рендериться настільки малим, наскільки він малий.
 */
const TREE_FIT_HEIGHT = 2.7;

/**
 * Висота дорослого дерева в одиницях рушія — те, що еталон відображає у 2.7.
 *
 * Узято з виміряних 4.97…5.25 при сталих розмірах: після зміни це і є
 * висота на повному терміні, бо закон росту множить саме ті числа.
 */
const TREE_REFERENCE_HEIGHT = 5.2;

/**
 * Fits a tree into the portal's frame.
 *
 * Width still clamps against the shared `ARTIFACT_FIT_WIDTH`: a crown wider
 * than the frame is a crown the camera cannot back away from, whatever the
 * height rule says.
 */
export function fitThreeTree(reach: ThreeTreeReach): ThreeTreeFit {
  const height = Math.max(1e-4, reach.maxY - reach.minY);
  const width = Math.max(1e-4, reach.crownReach * 2);
  /*
   * Еталон, а не «дотягнути до кадру». Інакше росток масштабувався б до
   * тієї самої висоти, що й сорокарічне дерево, і весь щойно доданий ріст
   * був би невидимий — рівно та вада, через яку кристалу колись зробили
   * `referenceScale` (ADR-0004).
   */
  const referenceScale = TREE_FIT_HEIGHT / TREE_REFERENCE_HEIGHT;
  // Кадр лишається твердою межею: незвично велика крона все одно
  // притискається, а не вилазить за екран.
  const containScale = Math.min(TREE_FIT_HEIGHT / height, ARTIFACT_FIT_WIDTH / width);
  const scale = Math.min(referenceScale, containScale);
  const lift = -reach.minY * scale;

  return {
    scale,
    groundY: CRYSTAL_GROUND_BASELINE + lift,
    height: height * scale,
    crownRadius: reach.crownReach * scale,
    soilRadius: reach.soilReach * scale,
    groundPlaneLift: lift,
  };
}
