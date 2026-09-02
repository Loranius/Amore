import type { TreeCompositionBranch } from '../composition';
import {
  add,
  clamp01,
  normalize,
  round6,
  roundVec,
  scale,
  seededUnit,
} from '../growth/math';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
} from '../labs/organic';
import type {
  BuildTreeFoliageInput,
  FoliageBranchRole,
  TreeFoliageCluster,
  TreeFoliageConfig,
  TreeFoliageState,
} from './types';

function validateInput(input: BuildTreeFoliageInput): void {
  const { config, frames, composition } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Foliage requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.minimumGeneration) || config.minimumGeneration < 1) {
    throw new Error('Tree Foliage minimumGeneration must be a positive integer.');
  }
  if (!Number.isFinite(config.terminalStart) || config.terminalStart < 0 || config.terminalStart >= 1) {
    throw new Error('Tree Foliage terminalStart must be in the [0, 1) range.');
  }
  if (
    !Number.isFinite(config.trunkTerminalStart)
    || config.trunkTerminalStart < 0
    || config.trunkTerminalStart >= 1
  ) {
    throw new Error('Tree Foliage trunkTerminalStart must be in the [0, 1) range.');
  }
  if (!Number.isFinite(config.clusterSpacing) || config.clusterSpacing <= 0) {
    throw new Error('Tree Foliage clusterSpacing must be a positive number.');
  }
  for (const [name, value] of [
    ['maxClusters', config.maxClusters],
    ['maxClustersPerBranch', config.maxClustersPerBranch],
    ['maxLeaves', config.maxLeaves],
    ['minLeavesPerCluster', config.minLeavesPerCluster],
    ['maxLeavesPerCluster', config.maxLeavesPerCluster],
  ] as const) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Tree Foliage ${name} must be a positive integer.`);
    }
  }
  if (config.minLeavesPerCluster > config.maxLeavesPerCluster) {
    throw new Error('Tree Foliage leaf count range is inverted.');
  }
  if (
    !Number.isFinite(config.minClusterRadius)
    || !Number.isFinite(config.maxClusterRadius)
    || config.minClusterRadius <= 0
    || config.minClusterRadius > config.maxClusterRadius
  ) {
    throw new Error('Tree Foliage cluster radius range is invalid.');
  }
  for (const role of ['trunk', 'primary', 'secondary', 'twig'] as const) {
    if (!Number.isInteger(config.clustersByRole[role]) || config.clustersByRole[role] <= 0) {
      throw new Error(`Tree Foliage clustersByRole.${role} must be a positive integer.`);
    }
  }
  if (frames.curves.length === 0) {
    throw new Error('Tree Foliage requires non-empty curve frames.');
  }
  if (composition.branches.length === 0) {
    throw new Error('Tree Foliage requires a non-empty Tree Composition state.');
  }
  if (composition.sourceSpeciesRulesVersion !== input.species.rulesVersion) {
    throw new Error('Tree Foliage species and composition rules do not match.');
  }
  if (composition.sourceFrameVersion !== frames.organicCurveFrameVersion) {
    throw new Error('Tree Foliage frame and composition versions do not match.');
  }
}

function nearestSample(
  samples: readonly OrganicCurveFrameSample[],
  normalizedDistance: number,
): OrganicCurveFrameSample {
  return samples.reduce((closest, sample) => (
    Math.abs(sample.normalizedDistance - normalizedDistance)
      < Math.abs(closest.normalizedDistance - normalizedDistance)
      ? sample
      : closest
  ), samples[0]!);
}

/**
 * Де на гілці починається листя.
 *
 * У бічних гілок — з `terminalStart`; у стовбура — значно вище, бо внизу
 * стовбур укритий корою, а не листям.
 */
function terminalStartFor(role: FoliageBranchRole, config: TreeFoliageConfig): number {
  return role === 'trunk' ? config.trunkTerminalStart : config.terminalStart;
}

/**
 * Скільки згустків несе ця гілка: рівно стільки, скільки вміщує її довжина.
 *
 * Роль дає нижню межу, довжина може її підняти до `maxClustersPerBranch`.
 * Довжина береться ламаною по вибірках — тими самими округленими числами, що
 * й уся інша геометрія, тож результат детермінований.
 */
function slotCountFor(
  curve: OrganicBranchCurve,
  role: FoliageBranchRole,
  config: TreeFoliageConfig,
): number {
  let length = 0;
  for (let index = 1; index < curve.samples.length; index += 1) {
    const previous = curve.samples[index - 1]!.position;
    const current = curve.samples[index]!.position;
    length += Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
      current.z - previous.z,
    );
  }
  const span = length * (1 - terminalStartFor(role, config));
  return Math.min(
    config.maxClustersPerBranch,
    Math.max(config.clustersByRole[role], Math.round(span / config.clusterSpacing)),
  );
}

interface ClusterCandidate {
  id: string;
  branchId: string;
  sourceSampleId: string;
  generation: number;
  role: FoliageBranchRole;
  seed: number;
  position: TreeFoliageCluster['position'];
  direction: TreeFoliageCluster['direction'];
  normal: TreeFoliageCluster['normal'];
  radius: number;
  density: number;
  leafCount: number;
  azimuthSectorIndex: number;
  verticalLayerIndex: number;
  crownCellId: string;
}

function buildCandidate(
  artifactSeed: number,
  curve: OrganicBranchCurve,
  branch: TreeCompositionBranch,
  role: FoliageBranchRole,
  slot: number,
  slotCount: number,
  input: BuildTreeFoliageInput,
): ClusterCandidate {
  const id = `tree:foliage:${branch.branchId}:${slot}`;
  const terminalStart = terminalStartFor(role, input.config);
  const jitter = (seededUnit(artifactSeed, `${id}:distance`) * 2 - 1)
    * (1 - terminalStart)
    / Math.max(slotCount * 5, 1);
  /*
   * ОСТАННІЙ ЗГУСТОК СІДАЄ НА САМИЙ КІНЧИК.
   *
   * Було `(slot + 1) / (slotCount + 1)`, тобто згустки ставали на 0.475,
   * 0.65 і 0.825 довжини — і зовнішня шоста частина КОЖНОЇ гілки лишалась
   * голою палицею. На знімку це читалось найгірше саме на довгих бічних
   * гілках: гілка йде вбік, а листя на ній кінчається задовго до кінця.
   *
   * У природі все навпаки: кінчик гілки — наймолодший приріст і
   * найлистяніше місце. Тепер `(slot + 1) / slotCount` дає 0.53, 0.77 і
   * 1.0 — останній згусток стоїть на вершечку.
   */
  const targetDistance = clamp01(
    terminalStart
      + ((slot + 1) / slotCount) * (1 - terminalStart)
      + jitter,
  );
  const terminalSamples = curve.samples.filter(
    (sample) => sample.normalizedDistance >= terminalStart,
  );
  const sample = nearestSample(terminalSamples.length > 0 ? terminalSamples : curve.samples, targetDistance);
  const radialUnit = seededUnit(artifactSeed, `${id}:radius`);
  const branchThickness = clamp01(branch.meanRadius / 0.14);
  const radiusMix = clamp01(radialUnit * 0.72 + branchThickness * 0.28);
  const radius = input.config.minClusterRadius
    + (input.config.maxClusterRadius - input.config.minClusterRadius) * radiusMix;
  const angle = seededUnit(artifactSeed, `${id}:angle`) * Math.PI * 2;
  const radialNormal = normalize(add(
    scale(sample.normal, Math.cos(angle)),
    scale(sample.binormal, Math.sin(angle)),
  ), sample.normal);
  const offset = sample.radius + radius * (0.28 + seededUnit(artifactSeed, `${id}:offset`) * 0.18);
  const position = add(sample.position, scale(radialNormal, offset));
  const outwardBias = 0.32 + seededUnit(artifactSeed, `${id}:direction`) * 0.28;
  const direction = normalize(add(sample.tangent, scale(radialNormal, outwardBias)), sample.tangent);
  const leafSpan = input.config.maxLeavesPerCluster - input.config.minLeavesPerCluster + 1;
  const roleBoost = role === 'twig' ? 2 : role === 'secondary' || role === 'trunk' ? 1 : 0;
  const leafCount = Math.min(
    input.config.maxLeavesPerCluster,
    input.config.minLeavesPerCluster
      + Math.floor(seededUnit(artifactSeed, `${id}:leaves`) * leafSpan)
      + roleBoost,
  );
  const density = clamp01(
    (leafCount / input.config.maxLeavesPerCluster) * 0.78
      + seededUnit(artifactSeed, `${id}:density`) * 0.22,
  );
  const layerValues = branch.verticalLayerIndices.length > 0
    ? branch.verticalLayerIndices
    : [0];
  const layerSlot = Math.min(
    layerValues.length - 1,
    Math.floor(targetDistance * layerValues.length),
  );
  const verticalLayerIndex = layerValues[layerSlot] ?? 0;
  const seed = Math.floor(seededUnit(artifactSeed, `${id}:seed`) * 0xffffffff);

  return {
    id,
    branchId: branch.branchId,
    sourceSampleId: sample.id,
    generation: branch.generation,
    role,
    seed,
    position: roundVec(position),
    direction: roundVec(direction),
    normal: roundVec(radialNormal),
    radius: round6(radius),
    density: round6(density),
    leafCount,
    azimuthSectorIndex: branch.azimuthSectorIndex,
    verticalLayerIndex,
    crownCellId: `${branch.azimuthSectorIndex}:${verticalLayerIndex}`,
  };
}

/**
 * Builds stable cluster identities and local placement from accepted composition.
 * Global budgets only truncate later candidates; emitted historical clusters are
 * never resized or redistributed when later branches are appended.
 */
export function buildTreeFoliage(input: BuildTreeFoliageInput): TreeFoliageState {
  validateInput(input);
  const branchesById = new Map(
    input.composition.branches.map((branch) => [branch.branchId, branch] as const),
  );
  const clusters: TreeFoliageCluster[] = [];
  const truncatedClusterIds: string[] = [];
  const eligibleBranchIds: string[] = [];
  const emittedByBranch = new Map<string, number>();
  let candidateClusterCount = 0;
  let totalLeafCount = 0;
  let maxClusterBudgetReached = false;
  let maxLeafBudgetReached = false;

  /*
   * СПЕРШУ ПО ОДНОМУ ЗГУСТКУ КОЖНІЙ ГІЛЦІ, І ЛИШЕ ПОТІМ РЕШТА.
   *
   * Досі бюджет витрачався гілка за гілкою: перша брала всі свої сім
   * згустків, друга свої шість, і так доки не скінчиться — а хвіст лишався
   * ЗОВСІМ голим. Виміряно на розгортці 0-40: у профілі «середня» на шостому
   * році 43 гілки зі 109 не мали жодного листка, тобто 40% дерева стояло
   * голою дротиною. На знімку дванадцятого року це три довгі прутики, що
   * стирчать із крони.
   *
   * Це ТА САМА вада, яку ADR-0075 уже лагодив («43 згустки з 140, і 32 гілки
   * з 50 лишились зовсім голими»), і повернулась вона тому, що тодішнє
   * виправлення зменшило витрату на згусток, а не змінило ПОРЯДОК витрати.
   * Відколи гілок стало вчетверо більше, порядок знову став вирішальним.
   *
   * Тепер два проходи. Перший роздає по одному згустку кожній гілці — це
   * гарантує, що жодна не лишиться голою, доки бюджету вистачає бодай на
   * одну на кожну. Другий добирає решту в тому самому порядку, що й раніше.
   * Обрізається й далі ПІЗНІШЕ, просто «пізніше» тепер означає «другий
   * згусток на гілці», а не «остання гілка».
   */
  interface PendingBranch {
    branch: TreeCompositionBranch;
    curve: OrganicBranchCurve;
    role: FoliageBranchRole;
    slotCount: number;
  }

  const pending: PendingBranch[] = [];
  for (const curve of input.frames.curves) {
    const branch = branchesById.get(curve.branchId);
    if (!branch || curve.samples.length === 0) continue;
    /*
     * Стовбур проходить повз поріг покоління навмисно: він завжди нульового
     * покоління, а `minimumGeneration` існує, щоб відсіяти надто МОЛОДІ гілки,
     * а не найстаршу. Свій поріг у стовбура інший — по довжині, не по
     * поколінню (`trunkTerminalStart`).
     */
    if (branch.role !== 'trunk' && branch.generation < input.config.minimumGeneration) {
      continue;
    }
    eligibleBranchIds.push(branch.branchId);
    pending.push({
      branch,
      curve,
      role: branch.role,
      slotCount: slotCountFor(curve, branch.role, input.config),
    });
  }

  const emit = (entry: PendingBranch, slot: number): void => {
    const candidate = buildCandidate(
      input.species.artifactSeed,
      entry.curve,
      entry.branch,
      entry.role,
      slot,
      entry.slotCount,
      input,
    );
    candidateClusterCount += 1;

    if (clusters.length >= input.config.maxClusters) {
      maxClusterBudgetReached = true;
      truncatedClusterIds.push(candidate.id);
      return;
    }
    if (totalLeafCount + candidate.leafCount > input.config.maxLeaves) {
      maxLeafBudgetReached = true;
      truncatedClusterIds.push(candidate.id);
      return;
    }

    clusters.push({ ...candidate, sequence: clusters.length });
    totalLeafCount += candidate.leafCount;
    emittedByBranch.set(
      entry.branch.branchId,
      (emittedByBranch.get(entry.branch.branchId) ?? 0) + 1,
    );
  };

  // Прохід перший: по одному на гілку.
  for (const entry of pending) {
    if (entry.slotCount > 0) emit(entry, 0);
  }
  // Прохід другий: решта, у тому самому порядку гілок.
  for (const entry of pending) {
    for (let slot = 1; slot < entry.slotCount; slot += 1) emit(entry, slot);
  }

  const occupiedCellIds = [...new Set(clusters.map((cluster) => cluster.crownCellId))].sort();
  const branchIdsWithoutFoliage = eligibleBranchIds
    .filter((branchId) => !emittedByBranch.has(branchId))
    .sort();

  return {
    treeFoliageVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    sourceFrameVersion: input.frames.organicCurveFrameVersion,
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    artifactSeed: input.species.artifactSeed,
    clusters,
    diagnostics: {
      candidateClusterCount,
      emittedClusterCount: clusters.length,
      totalLeafCount,
      occupiedCellIds,
      truncatedClusterIds,
      branchIdsWithoutFoliage,
      maxClusterBudgetReached,
      maxLeafBudgetReached,
    },
  };
}
