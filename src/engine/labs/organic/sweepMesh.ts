import {
  add,
  cross,
  distance,
  dot,
  lerp,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  subtract,
} from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';
import { barkRelief, barkReliefPhase } from './barkRelief';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { ORGANIC_TRUNK_BRANCH_ID } from './surfaceTypes';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
  OrganicCurveFrameState,
  OrganicJunctionAnchor,
  BarkReliefConfig,
  OrganicMeshLod,
  OrganicSurfaceConfig,
  OrganicSweepMesh,
} from './surfaceTypes';

interface PreparedCurveSamples {
  samples: OrganicCurveFrameSample[];
  junctionRingCount: number;
}

interface ParentJunctionInfluence {
  junction: OrganicJunctionAnchor;
  reachesTerminal: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function sampleByStride(
  samples: readonly OrganicCurveFrameSample[],
  stride: number,
): OrganicCurveFrameSample[] {
  const sampled = samples.filter(
    (_sample, index) => index === 0 || index === samples.length - 1 || index % stride === 0,
  );
  if (sampled.length >= 2) return sampled;
  const first = samples[0];
  const last = samples[samples.length - 1];
  return first && last ? [first, last] : [];
}

/**
 * Де стоїть кільце коміра на шляху від батьківської гілки до дочірньої.
 *
 * Один графік для всього: і для позиції кільця, і для його радіуса, і для
 * повороту рамки. Досі їх було два — центри йшли за `(index-1)/(ringCount-1)`,
 * а радіус і рамка за `index/ringCount`. На п'яти кільцях це означає, що
 * останнє кільце стоїть на 0.75 шляху, маючи радіус і поворот від 0.8: поверхня
 * розходиться сама з собою, і стик гілки зі стовбуром отримує зайву складку.
 * Індекси 0 і 1 — це врізка в батьківське тіло та вихід на його поверхню;
 * звуження починається щойно після них.
 */
function junctionT(index: number, ringCount: number): number {
  if (ringCount <= 1 || index <= 1) return 0;
  return (index - 1) / (ringCount - 1);
}

function junctionCenters(
  curve: OrganicBranchCurve,
  joinSample: OrganicCurveFrameSample,
  ringCount: number,
): GrowthVec3[] {
  const junction = curve.junction;
  if (!junction || ringCount <= 0) return [];
  const centers: GrowthVec3[] = [junction.insetPosition];
  if (ringCount === 1) return centers;

  centers.push(junction.surfacePosition);
  for (let index = 2; index < ringCount; index += 1) {
    const t = junctionT(index, ringCount);
    const eased = smoothstep(t);
    const guided = lerp(junction.surfacePosition, joinSample.position, eased);
    const arcLift = Math.sin(Math.PI * t) * junction.parentRadius * 0.16;
    centers.push(add(guided, scale(junction.parentTangent, arcLift)));
  }
  return centers;
}

function frameForJunctionSample(
  tangent: GrowthVec3,
  startNormal: GrowthVec3,
  endNormal: GrowthVec3,
  t: number,
): { normal: GrowthVec3; binormal: GrowthVec3 } {
  const fallback = orthonormalBasis(tangent);
  const desired = lerp(startNormal, endNormal, smoothstep(t));
  const projected = subtract(desired, scale(tangent, dot(desired, tangent)));
  const normal = normalize(projected, fallback.tangent);
  const binormal = normalize(cross(tangent, normal), fallback.bitangent);
  return {
    normal: normalize(cross(binormal, tangent), normal),
    binormal,
  };
}

function buildJunctionSamples(
  curve: OrganicBranchCurve,
  joinSample: OrganicCurveFrameSample,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
): OrganicCurveFrameSample[] {
  const junction = curve.junction;
  if (!junction) return [];
  const ringCount = Math.max(1, Math.floor(config.junctionSegmentsByLod[lod]));
  const centers = junctionCenters(curve, joinSample, ringCount);
  const startTangent = normalize(junction.radialDirection, junction.childDirection);
  const basis = orthonormalBasis(startTangent);
  const projectedParentTangent = subtract(
    junction.parentTangent,
    scale(startTangent, dot(junction.parentTangent, startTangent)),
  );
  const startNormal = normalize(projectedParentTangent, basis.tangent);

  return centers.map((position, index) => {
    const previous = centers[index - 1] ?? position;
    const next = centers[index + 1] ?? joinSample.position;
    const tangent = roundVec(normalize(subtract(next, previous), startTangent));
    const t = junctionT(index, ringCount);
    const frame = frameForJunctionSample(tangent, startNormal, joinSample.normal, t);
    const radius = junction.collarRadius
      + (joinSample.radius - junction.collarRadius) * smoothstep(t);

    return {
      id: `${curve.branchId}:junction:${lod}:${index}`,
      sourceNodeId: junction.parentNodeId,
      branchId: curve.branchId,
      generation: curve.generation,
      normalizedDistance: round6(joinSample.normalizedDistance * t),
      position: roundVec(position),
      tangent,
      normal: roundVec(frame.normal),
      binormal: roundVec(frame.binormal),
      radius: round6(Math.max(config.minimumRadius, radius)),
    };
  });
}

function prepareCurveForLod(
  curve: OrganicBranchCurve,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
): PreparedCurveSamples {
  const stride = Math.max(1, Math.floor(config.axialStrideByLod[lod]));
  if (!curve.junction) {
    return {
      samples: sampleByStride(curve.samples, stride),
      junctionRingCount: 0,
    };
  }

  const joinIndex = Math.min(
    curve.samples.length - 1,
    Math.max(1, curve.junction.joinSampleIndex),
  );
  const tail = sampleByStride(curve.samples.slice(joinIndex), stride);
  const joinSample = tail[0];
  if (!joinSample) return { samples: [], junctionRingCount: 0 };
  const junctionSamples = buildJunctionSamples(curve, joinSample, lod, config);
  return {
    samples: [...junctionSamples, ...tail],
    junctionRingCount: junctionSamples.length,
  };
}

function collectParentJunctionInfluences(
  frameState: OrganicCurveFrameState,
): ReadonlyMap<string, ParentJunctionInfluence[]> {
  const curvesById = new Map(frameState.curves.map((curve) => [curve.branchId, curve]));
  const influencesByParent = new Map<string, ParentJunctionInfluence[]>();

  for (const childCurve of frameState.curves) {
    const junction = childCurve.junction;
    if (!junction) continue;
    const parentCurve = curvesById.get(junction.parentBranchId);
    const terminalSample = parentCurve?.samples[parentCurve.samples.length - 1];
    if (!parentCurve || !terminalSample) continue;

    const terminalDistance = distance(junction.parentPosition, terminalSample.position);
    const terminalThreshold = Math.max(
      junction.parentRadius * 1.35,
      terminalSample.radius * 1.75,
    );
    const influence: ParentJunctionInfluence = {
      junction,
      reachesTerminal: junction.parentNodeId === parentCurve.terminalNodeId
        || terminalDistance <= terminalThreshold,
    };
    const existing = influencesByParent.get(junction.parentBranchId);
    if (existing) existing.push(influence);
    else influencesByParent.set(junction.parentBranchId, [influence]);
  }

  return influencesByParent;
}

function junctionBulge(
  sample: OrganicCurveFrameSample,
  radialNormal: GrowthVec3,
  influences: readonly ParentJunctionInfluence[],
): number {
  let directionalBulge = 0;
  let terminalFlare = 0;

  for (const influence of influences) {
    const { junction } = influence;
    const blendLength = Math.max(
      junction.parentRadius * 2.1,
      junction.collarRadius * 2.6,
      1e-4,
    );
    const proximity = 1 - distance(sample.position, junction.parentPosition) / blendLength;
    if (proximity <= 0) continue;

    const axialWeight = smoothstep(proximity);
    const facing = clamp01((dot(radialNormal, junction.radialDirection) + 0.12) / 1.12);
    const angularWeight = smoothstep(facing);
    const maximumButtress = Math.min(
      junction.parentRadius * 0.34,
      junction.collarRadius * 0.52,
    );
    directionalBulge += maximumButtress * axialWeight * angularWeight;

    if (influence.reachesTerminal) {
      terminalFlare = Math.max(terminalFlare, sample.radius * 0.12 * axialWeight);
    }
  }

  return terminalFlare + Math.min(sample.radius * 0.48, directionalBulge);
}

function pushVec(target: number[], vector: GrowthVec3): void {
  target.push(round6(vector.x), round6(vector.y), round6(vector.z));
}

/** What a ring needs to know about the wood it is part of. */
interface BarkReliefContext {
  config: BarkReliefConfig;
  /** Per-branch phase, so two branches are not the same log. */
  phase: number;
  /** Arc length from the branch's first sample, in engine units. */
  axial: number;
}

function addRing(
  positions: number[],
  normals: number[],
  uvs: number[],
  sample: OrganicCurveFrameSample,
  ringIndex: number,
  ringCount: number,
  radialSegments: number,
  parentJunctions: readonly ParentJunctionInfluence[],
  bark: BarkReliefContext,
): void {
  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const angle = radialIndex / radialSegments * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const radialNormal = normalize(add(
      scale(sample.normal, cosine),
      scale(sample.binormal, sine),
    ));
    const bulged = sample.radius + junctionBulge(sample, radialNormal, parentJunctions);
    const relief = barkRelief(angle, bark.axial, bulged, bark.phase, bark.config);
    pushVec(positions, add(sample.position, scale(radialNormal, bulged * relief.radiusScale)));
    // Tilt the normal onto the lobed surface. For a cross-section r(θ) the
    // in-plane normal is r·u − r′·t, which is the radial direction leaned
    // towards the tangential one by (∂r/∂θ)/r. Publishing the plain radial
    // normal instead would light the trunk as a perfect cylinder and the
    // relief would survive only on the silhouette.
    const tangential = normalize(add(
      scale(sample.normal, -sine),
      scale(sample.binormal, cosine),
    ));
    pushVec(normals, normalize(subtract(
      radialNormal,
      scale(tangential, relief.angularSlope),
    )));
    uvs.push(
      ringCount <= 1 ? 0 : round6(ringIndex / (ringCount - 1)),
      round6(radialIndex / radialSegments),
    );
  }
}

function addTubeIndices(
  indices: number[],
  firstVertex: number,
  ringCount: number,
  radialSegments: number,
): void {
  for (let ringIndex = 0; ringIndex < ringCount - 1; ringIndex += 1) {
    const currentRing = firstVertex + ringIndex * radialSegments;
    const nextRing = currentRing + radialSegments;
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const nextRadial = (radialIndex + 1) % radialSegments;
      const a = currentRing + radialIndex;
      const b = nextRing + radialIndex;
      const c = nextRing + nextRadial;
      const d = currentRing + nextRadial;
      indices.push(a, d, b, b, d, c);
    }
  }
}

function addCap(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  sample: OrganicCurveFrameSample,
  radialSegments: number,
  outwardNormal: GrowthVec3,
  reverse: boolean,
): void {
  const capNormal = normalize(outwardNormal);
  const centerVertex = positions.length / 3;
  pushVec(positions, sample.position);
  pushVec(normals, capNormal);
  uvs.push(0.5, 0.5);

  const capRingStart = positions.length / 3;
  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const angle = radialIndex / radialSegments * Math.PI * 2;
    const radialNormal = normalize(add(
      scale(sample.normal, Math.cos(angle)),
      scale(sample.binormal, Math.sin(angle)),
    ));
    pushVec(positions, add(sample.position, scale(radialNormal, sample.radius)));
    pushVec(normals, capNormal);
    uvs.push(
      round6(0.5 + Math.cos(angle) * 0.5),
      round6(0.5 + Math.sin(angle) * 0.5),
    );
  }

  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const current = capRingStart + radialIndex;
    const next = capRingStart + (radialIndex + 1) % radialSegments;
    if (reverse) indices.push(centerVertex, next, current);
    else indices.push(centerVertex, current, next);
  }
}

function maximumFrameRadius(frameState: OrganicCurveFrameState): number {
  return Math.max(
    1e-6,
    ...frameState.curves.flatMap((curve) => curve.samples.map((sample) => sample.radius)),
  );
}

/**
 * Найбільша похибка силуету, яку дозволено кільцю, у одиницях сцени.
 *
 * ЗВІДКИ ЧИСЛО. Багатокутник із `N` сторін описує коло з похибкою
 * `r · (1 − cos(π/N))` — саме на стільки його обрис западає всередину справжнього
 * кола. Дерево пари заввишки 5.7 одиниці займає на телефоні близько 360 пікселів,
 * тобто один піксель — це приблизно 0.016 одиниці. 0.006 — трохи менше за третину
 * пікселя: похибка, якої на екрані не видно навіть упритул.
 *
 * Це і є той поріг, за яким сторони перестають щось давати.
 */
const SILHOUETTE_TOLERANCE = 0.008;

/**
 * Радіус основи, на якому виміряно допуск вище.
 *
 * ДОПУСК МАСШТАБУЄТЬСЯ РАЗОМ ІЗ ДЕРЕВОМ, і це не поблажка, а те саме
 * міркування, доведене до кінця. Півпікселя виміряно на дереві заввишки 5.7
 * з основою 0.079, яке камера кадрує на весь екран. Але камера кадрує КОЖНЕ
 * дерево на весь екран — отже вдвічі товще дерево показує кожну гілку вдвічі
 * дрібнішою, і та сама половина пікселя відповідає вдвічі більшому допуску у
 * світових одиницях.
 *
 * Без цього пара, що жила всіма шістьма модулями, вибивала мобільну стелю:
 * виміряно 22 045 трикутників при 18 000. Різати натомість силу росту
 * означало б відібрати в дерева здатність відповідати на життя пари — а її
 * щойно з такими труднощами здобули.
 */
const SILHOUETTE_REFERENCE_RADIUS = 0.079;

/**
 * Менше трьох сторін труби не буває, а чотири — найменше, що ще має обсяг.
 * Трикутний переріз на просвіт читається як пласка стрічка.
 */
const MINIMUM_RADIAL_SEGMENTS = 4;

/**
 * Скільки сторін має кільце цієї гілки.
 *
 * ЩО БУЛО ДО ЦЬОГО. Сходинки за поколінням: стовбур діставав повні 13 сторін,
 * друге покоління 11, решта 9 — із підлогами 7 і 6. Підлоги стерегли рельєф
 * кори, якому треба близько чотирьох вершин на лопать.
 *
 * ЧОМУ ЦЕ БУЛО ЗАЙВЕ. Рельєф на тонких гілках НЕ МАЛЮЄТЬСЯ ВЗАГАЛІ:
 * `barkRelief` гасить його глибину як `radius / fadeRadius`, і в самому файлі
 * написано «twigs stay smooth». Тобто дев'ять сторін на гілочці завтовшки
 * 0.014 стерегли рельєф, якого там немає, — а платило за них усе дерево.
 *
 * Доки гілок було тринадцять, це нічого не коштувало. Самоорганізаційна модель
 * дала їх 56-104, майже всі тонкі, і ця дрібниця стала головною статтею
 * витрат: виміряно 21 933 трикутники на трьох роках і 26 992 на шести проти
 * мобільної стелі 18 000.
 *
 * ЩО ТЕПЕР. Там, де рельєф видно (радіус від `fadeRadius`), кільце лишається
 * повним — його вимагає рельєф, а не силует. Нижче — стільки сторін, скільки
 * треба, щоб обрис не западав більш ніж на `SILHOUETTE_TOLERANCE`. Це
 * ФІЗИЧНА межа, а не смак: тонша гілка займає менше пікселів, тож і сторін їй
 * треба менше, і закон каже це прямо замість сходинок за поколінням.
 */
function radialSegmentsForCurve(
  curve: OrganicBranchCurve,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
  maximumRadius: number,
): number {
  const baseSegments = Math.max(3, Math.floor(config.radialSegmentsByLod[lod]));
  if (lod === 'low') return baseSegments;

  const curveRadius = Math.max(
    curve.junction?.collarRadius ?? 0,
    ...curve.samples.map((sample) => sample.radius),
  );

  // Стовбур і все, на чому видно рельєф, лишаються повними.
  if (curve.branchId === ORGANIC_TRUNK_BRANCH_ID
    || curve.generation === 0
    || curveRadius >= config.bark.fadeRadius) {
    return baseSegments;
  }

  // Допуск у частках дерева, а не в абсолютних одиницях: камера кадрує
  // будь-яке дерево на весь екран, тож більше дерево має право на грубші
  // кільця в тих самих пікселях.
  const tolerance = SILHOUETTE_TOLERANCE
    * (Math.max(maximumRadius, 1e-6) / SILHOUETTE_REFERENCE_RADIUS);

  // Найменше `N`, за якого `r · (1 − cos(π/N))` уміщується в допуск.
  for (let segments = MINIMUM_RADIAL_SEGMENTS; segments < baseSegments; segments += 1) {
    if (curveRadius * (1 - Math.cos(Math.PI / segments)) <= tolerance) {
      return segments;
    }
  }
  return baseSegments;
}

export function buildOrganicSweepMesh(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig = DEFAULT_ORGANIC_SURFACE_CONFIG,
): OrganicSweepMesh {
  const maximumRadius = maximumFrameRadius(frameState);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const branches: OrganicSweepMesh['branches'] = [];
  const junctionsByParent = collectParentJunctionInfluences(frameState);
  let ringCount = 0;
  let junctionRingCount = 0;

  for (const curve of frameState.curves) {
    const radialSegments = radialSegmentsForCurve(curve, lod, config, maximumRadius);
    const prepared = prepareCurveForLod(curve, lod, config);
    const samples = prepared.samples;
    if (samples.length < 2) continue;
    const firstVertex = positions.length / 3;
    const firstIndex = indices.length;
    const parentJunctions = junctionsByParent.get(curve.branchId) ?? [];

    // Arc length, not the sample index: swellings measured in ring counts
    // would crowd together on a short twig and stretch out on the trunk.
    const phase = barkReliefPhase(curve.branchId);
    let axial = 0;
    samples.forEach((sample, index) => {
      const previous = samples[index - 1];
      if (previous) axial += distance(previous.position, sample.position);
      addRing(
        positions,
        normals,
        uvs,
        sample,
        index,
        samples.length,
        radialSegments,
        parentJunctions,
        { config: config.bark, phase, axial },
      );
    });
    addTubeIndices(indices, firstVertex, samples.length, radialSegments);

    if (curve.branchId === ORGANIC_TRUNK_BRANCH_ID) {
      addCap(
        positions,
        normals,
        uvs,
        indices,
        samples[0]!,
        radialSegments,
        scale(samples[0]!.tangent, -1),
        true,
      );
    }

    const opensIntoChildBranches = parentJunctions.some((influence) => influence.reachesTerminal);
    if (!opensIntoChildBranches) {
      addCap(
        positions,
        normals,
        uvs,
        indices,
        samples[samples.length - 1]!,
        radialSegments,
        samples[samples.length - 1]!.tangent,
        false,
      );
    }

    ringCount += samples.length;
    junctionRingCount += prepared.junctionRingCount;
    branches.push({
      branchId: curve.branchId,
      firstVertex,
      vertexCount: positions.length / 3 - firstVertex,
      firstIndex,
      indexCount: indices.length - firstIndex,
      ringCount: samples.length,
      junctionRingCount: prepared.junctionRingCount,
      radialSegments,
    });
  }

  return {
    organicSweepMeshVersion: 1,
    lod,
    sourceRulesVersion: frameState.sourceRulesVersion,
    positions,
    normals,
    uvs,
    indices,
    branches,
    diagnostics: {
      branchCount: branches.length,
      junctionCount: branches.filter((branch) => branch.junctionRingCount > 0).length,
      ringCount,
      junctionRingCount,
      vertexCount: positions.length / 3,
      triangleCount: indices.length / 3,
    },
  };
}
