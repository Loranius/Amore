import { round6 } from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type {
  BuildTreeTerrainBindingInput,
  TreeTerrainBindingState,
  TreeTerrainSurfaceMesh,
} from './types';

const EPSILON = 1e-9;

function validateInput(input: BuildTreeTerrainBindingInput): void {
  const { species, contact, lod, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Terrain Binding requires a non-empty rulesVersion.');
  }
  if (species.artifactSeed !== contact.artifactSeed) {
    throw new Error('Tree Terrain Binding received Ground Contact from another artifact.');
  }
  if (contact.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion) {
    throw new Error('Tree Terrain Binding Ground Contact provenance does not match Tree Species.');
  }
  if (contact.ground.terrainBindingId !== 'tree:terrain:future') {
    throw new Error('Tree Terrain Binding requires the stable future terrain binding slot.');
  }
  for (const [name, value] of [
    ['surfaceRadiusRootCoverageRatio', config.surfaceRadiusRootCoverageRatio],
    ['minimumSurfaceRadiusBaseRatio', config.minimumSurfaceRadiusBaseRatio],
    ['plateauRootCoverageRatio', config.plateauRootCoverageRatio],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Tree Terrain Binding ${name} must be positive and finite.`);
    }
  }
  if (!Number.isFinite(config.reliefAmplitudeBaseRadiusRatio)
    || config.reliefAmplitudeBaseRadiusRatio < 0) {
    throw new Error('Tree Terrain Binding relief amplitude ratio must be finite and non-negative.');
  }
  if (config.plateauRootCoverageRatio >= config.surfaceRadiusRootCoverageRatio) {
    throw new Error('Tree Terrain Binding plateau must leave a relief margin outside root coverage.');
  }
  for (const currentLod of ['high', 'medium', 'low'] as const) {
    const segments = config.radialSegmentsByLod[currentLod];
    const rings = config.ringCountByLod[currentLod];
    const vertices = config.maximumVerticesByLod[currentLod];
    const triangles = config.maximumTrianglesByLod[currentLod];
    if (!Number.isInteger(segments) || segments < 8) {
      throw new Error(`Tree Terrain Binding ${currentLod} requires at least eight radial segments.`);
    }
    if (!Number.isInteger(rings) || rings < 2) {
      throw new Error(`Tree Terrain Binding ${currentLod} requires at least two rings.`);
    }
    if (!Number.isInteger(vertices) || vertices < 0) {
      throw new Error(`Tree Terrain Binding ${currentLod} vertex budget must be non-negative.`);
    }
    if (!Number.isInteger(triangles) || triangles < 0) {
      throw new Error(`Tree Terrain Binding ${currentLod} triangle budget must be non-negative.`);
    }
  }
  if (!(lod in config.radialSegmentsByLod) || !(lod in config.ringCountByLod)) {
    throw new Error(`Tree Terrain Binding received unsupported LOD: ${String(lod)}.`);
  }
}

function radialDistance(point: GrowthVec3, center: GrowthVec3): number {
  return Math.hypot(point.x - center.x, point.z - center.z);
}

function buildNormals(positions: readonly number[], indices: readonly number[]): number[] {
  const normals = new Array<number>(positions.length).fill(0);
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index]! * 3;
    const ib = indices[index + 1]! * 3;
    const ic = indices[index + 2]! * 3;
    const abx = positions[ib]! - positions[ia]!;
    const aby = positions[ib + 1]! - positions[ia + 1]!;
    const abz = positions[ib + 2]! - positions[ia + 2]!;
    const acx = positions[ic]! - positions[ia]!;
    const acy = positions[ic + 1]! - positions[ia + 1]!;
    const acz = positions[ic + 2]! - positions[ia + 2]!;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const offset of [ia, ib, ic]) {
      normals[offset] = normals[offset]! + nx;
      normals[offset + 1] = normals[offset + 1]! + ny;
      normals[offset + 2] = normals[offset + 2]! + nz;
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const x = normals[index]!;
    const y = normals[index + 1]!;
    const z = normals[index + 2]!;
    const length = Math.hypot(x, y, z);
    if (length <= EPSILON) {
      normals[index] = 0;
      normals[index + 1] = 1;
      normals[index + 2] = 0;
    } else {
      normals[index] = round6(x / length);
      normals[index + 1] = round6(y / length);
      normals[index + 2] = round6(z / length);
    }
  }
  return normals;
}

function buildSurfaceMesh(
  center: GrowthVec3,
  groundLevelY: number,
  surfaceRadius: number,
  plateauRadius: number,
  reliefAmplitude: number,
  radialSegments: number,
  ringCount: number,
  artifactSeed: number,
  rimLobeDepth: number,
): TreeTerrainSurfaceMesh {
  const positions: number[] = [center.x, groundLevelY, center.z];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  const phase = (Math.abs(Math.trunc(artifactSeed)) % 6_283) / 1_000;

  for (let ring = 1; ring <= ringCount; ring += 1) {
    const ringRatio = ring / ringCount;
    const radius = surfaceRadius * ringRatio;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const reliefRatio = radius <= plateauRadius
        ? 0
        : Math.min(1, (radius - plateauRadius) / Math.max(EPSILON, surfaceRadius - plateauRadius));
      const smoothRelief = reliefRatio * reliefRatio * (3 - 2 * reliefRatio);
      const wave = Math.sin(angle * 3 + phase) * 0.55
        + Math.cos(angle * 5 - phase * 0.7) * 0.3
        + Math.sin(angle * 2 + phase * 0.4) * 0.15;
      /*
       * КРАЙ ҐРУНТУ — НЕ ЦИРКУЛЬ.
       *
       * Досі `radius` не залежав від кута взагалі, тож ґрунт навколо стовбура
       * лежав ідеальним колом, і на знімку читався гумовим килимком, а не
       * землею. Тією самою хвилею, що вже ліпить рельєф по висоті, тепер
       * ліпиться й обрис.
       *
       * ЛІПИТЬСЯ ЛИШЕ КРАЙ, І ЦЕ НЕ ОХАЙНІСТЬ. Плато мусить лишатись
       * круглим: воно накриває коріння, і рушій це перевіряє
       * (`plateauRadius >= rootCoverageRadius`). Якби множник діяв на всі
       * кільця однаково, за глибини 0.12 плато стягнулось би до 0.88 свого
       * радіуса — і кінці коренів вийшли б з-під землі, тоді як опублікована
       * перевірка й далі казала б «усе гаразд», бо міряє НЕЗМІНЕНЕ число.
       *
       * Тому втягування росте від нуля на плато до повного на краю — тим
       * самим `smoothRelief`, яким іде рельєф.
       *
       * Стеля глибини — з умови, що кільця не міняються місцями. Плато
       * займає 0.9 радіуса, тож поза ним лежить рівно одне кільце: зовнішнє
       * на 1.0, сусіднє на 6/7 = 0.857 і зовсім без втягування. Звідси
       * 1 - глибина > 0.857, тобто глибина < 0.143. Взято 0.12.
       *
       * Тут була ще й зайва спроба: кільця згущувались до краю показником
       * 0.55, «щоб на край припало два кільця замість одного». Складка,
       * заради якої це робилось, бралась не з числа кілець, а з глибини 0.5;
       * а от рівної землі під корінням та зміна лишала менше — 1.013 радіуса
       * покриття замість 1.046. Прибрано.
       *
       * Хвиля тільки ВТЯГУЄ край усередину (множник у [1-глибина, 1]), тож
       * `surfaceRadius` лишається чесною верхньою межею — усе, що на неї
       * покладається (трава, каміння, UV), не зачеплено.
       */
      const rimLobe = 1 - rimLobeDepth * smoothRelief * (0.5 - wave * 0.5);
      const shapedRadius = radius * rimLobe;
      const x = center.x + Math.cos(angle) * shapedRadius;
      const z = center.z + Math.sin(angle) * shapedRadius;
      const y = groundLevelY + reliefAmplitude * smoothRelief * wave;
      positions.push(round6(x), round6(y), round6(z));
      uvs.push(
        round6(0.5 + ((x - center.x) / surfaceRadius) * 0.5),
        round6(0.5 + ((z - center.z) / surfaceRadius) * 0.5),
      );
    }
  }

  for (let segment = 0; segment < radialSegments; segment += 1) {
    const current = 1 + segment;
    const next = 1 + ((segment + 1) % radialSegments);
    indices.push(0, next, current);
  }
  for (let ring = 1; ring < ringCount; ring += 1) {
    const innerStart = 1 + (ring - 1) * radialSegments;
    const outerStart = 1 + ring * radialSegments;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      const innerCurrent = innerStart + segment;
      const innerNext = innerStart + next;
      const outerCurrent = outerStart + segment;
      const outerNext = outerStart + next;
      indices.push(
        innerCurrent, outerNext, outerCurrent,
        innerCurrent, innerNext, outerNext,
      );
    }
  }

  return {
    positions,
    normals: buildNormals(positions, indices),
    uvs,
    indices,
  };
}

/**
 * Pure heightfield binding. It fulfils the stable Ground Contact terrain slot,
 * keeps the whole accepted root footprint on a flat plateau and publishes a
 * bounded relief skirt that can be merged into the static root geometry.
 */
export function buildTreeTerrainBinding(
  input: BuildTreeTerrainBindingInput,
): TreeTerrainBindingState {
  validateInput(input);
  const { species, contact, lod, config } = input;
  const center = { ...contact.collar.center, y: contact.ground.levelY };
  const rootCoverageRadius = round6(Math.max(
    contact.collar.bottomRadius,
    ...contact.visibleRootFrames.curves.flatMap((curve) => curve.samples)
      .map((sample) => radialDistance(sample.position, center)),
  ));
  const surfaceRadius = round6(Math.max(
    rootCoverageRadius * config.surfaceRadiusRootCoverageRatio,
    species.structure.baseRadius * config.minimumSurfaceRadiusBaseRatio,
  ));
  const plateauRadius = round6(Math.min(
    surfaceRadius * 0.9,
    Math.max(
      rootCoverageRadius * config.plateauRootCoverageRatio,
      contact.collar.bottomRadius * 1.2,
    ),
  ));
  const reliefAmplitude = round6(
    species.structure.baseRadius * config.reliefAmplitudeBaseRadiusRatio,
  );
  const radialSegments = config.radialSegmentsByLod[lod];
  const ringCount = config.ringCountByLod[lod];
  /*
   * ПЛАТО ПРИВ'ЯЗАНЕ ДО МЕЖІ КІЛЬЦЯ.
   *
   * Кільця розкладені лінійно (`surfaceRadius * ring / ringCount`), а
   * пласким лишається те, що не далі за `plateauRadius`. Тобто пласка
   * зона КВАНТУЄТЬСЯ кроком кільця, і опублікована обіцянка
   * «плато накриває коріння» справджувалась лише поки крок був дрібним
   * відносно плато.
   *
   * Коли дерево дістало вік (`species/tree/growthLaw.ts`), на молодому
   * дереві крок став грубим відносно коріння — і найближче кільце впало
   * ВСЕРЕДИНУ коріння: виміряно 0.1145 пласкої зони при 0.1200 покриття
   * коренів, тобто кінці коренів вийшли б з-під землі.
   *
   * Вада була тут завжди; сталий розмір дерева її ховав. Округлення
   * ВГОРУ до межі кільця строго збільшує пласку зону, тож гарантію воно
   * лише зміцнює.
   */
  const ringStep = surfaceRadius / Math.max(1, ringCount);
  /*
   * ОКРУГЛЕННЯ НЕ СМІЄ З'ЇСТИ ОСТАННЄ КІЛЬЦЕ.
   *
   * Стеля тут була `surfaceRadius`, і цього виявилось замало. На `low`
   * кілець лише чотири, тож крок 0.0723; плато 0.241 округлювалось до
   * 0.289 — тобто ТОЧНО в поверхню, — і за плато не лишалось жодного
   * кільця. А край ґрунту ліпиться саме поза плато (`reliefRatio`), тож
   * ґрунт ставав ідеальним колом: виміряно край 0.2894..0.2894 проти
   * 0.2557..0.2864 на `high`.
   *
   * Це та сама вада, що й в ADR-0090, з іншого кінця: там округлення
   * ЗАБУВАЛИ й коріння вилазило зі схилу, тут воно з'їдало все. Ловить її
   * чужий тест «shapes the soil rim without folding one ring inside
   * another», і саме він і впав, коли дерево трохи змінило пропорції.
   *
   * Одне кільце під край — це мінімум, за якого `reliefRatio` взагалі має
   * де змінитись від нуля до одиниці.
   */
  const snappedPlateauRadius = round6(Math.min(
    // Обмеження не сміє опустити плато нижче за саме коріння — інакше це
    // була б вада ADR-0090 з протилежного боку. Тому спершу максимум.
    Math.max(plateauRadius, surfaceRadius - ringStep),
    Math.ceil(plateauRadius / Math.max(EPSILON, ringStep)) * ringStep,
  ));
  const mesh = buildSurfaceMesh(
    center,
    contact.ground.levelY,
    surfaceRadius,
    snappedPlateauRadius,
    reliefAmplitude,
    radialSegments,
    ringCount,
    species.artifactSeed,
    config.rimLobeDepth,
  );
  const yValues = mesh.positions.filter((_, index) => index % 3 === 1);
  const minimumY = round6(Math.min(...yValues));
  const maximumY = round6(Math.max(...yValues));
  const vertexCount = mesh.positions.length / 3;
  const triangleCount = mesh.indices.length / 3;
  const vertexBudget = config.maximumVerticesByLod[lod];
  const triangleBudget = config.maximumTrianglesByLod[lod];
  const vertexBudgetExceeded = vertexCount > vertexBudget;
  const triangleBudgetExceeded = triangleCount > triangleBudget;

  if (plateauRadius + EPSILON < rootCoverageRadius) {
    throw new Error('Tree Terrain Binding failed to preserve the accepted root footprint.');
  }
  if (vertexBudgetExceeded || triangleBudgetExceeded) {
    throw new Error(
      `Tree Terrain Binding exceeded the ${lod} mobile mesh budget: `
        + `${vertexCount}/${vertexBudget} vertices, `
        + `${triangleCount}/${triangleBudget} triangles.`,
    );
  }

  return {
    treeTerrainBindingVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceGroundContactVersion: contact.treeGroundContactVersion,
    sourceGroundContactRulesVersion: contact.rulesVersion,
    artifactSeed: species.artifactSeed,
    lod,
    binding: {
      id: 'tree:terrain:binding',
      sourceBindingId: contact.ground.terrainBindingId,
      surfaceId: 'tree:terrain:surface',
      heightfieldId: 'tree:terrain:heightfield',
      groundPlaneId: contact.ground.id,
    },
    center,
    groundLevelY: contact.ground.levelY,
    surfaceRadius,
    plateauRadius,
    mesh,
    diagnostics: {
      radialSegments,
      ringCount,
      vertexCount,
      triangleCount,
      surfaceRadius,
      plateauRadius,
      rootCoverageRadius,
      minimumY,
      maximumY,
      maximumHeightDelta: round6(Math.max(
        Math.abs(minimumY - contact.ground.levelY),
        Math.abs(maximumY - contact.ground.levelY),
      )),
      vertexBudget,
      triangleBudget,
      vertexBudgetExceeded,
      triangleBudgetExceeded,
      groundPlanePreserved: true,
      rootCoveragePreserved: true,
      mergedIntoRootGeometry: true,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
    },
  };
}
