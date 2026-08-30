import { normalize } from '../growth/math';
import type { TreeGroundContactState } from '../groundContact';
import {
  barkRelief,
  barkReliefPhase,
  buildOrganicSweepMesh,
  ORGANIC_TRUNK_BRANCH_ID,
  type BarkReliefConfig,
  type OrganicMeshLod,
  type OrganicSweepMesh,
} from '../labs/organic';
import type { TreeTerrainBindingState } from '../terrainBinding';
import type {
  BuildTreeRootGeometryInput,
  TreeRootGeometryState,
} from './types';

function validateInput(input: BuildTreeRootGeometryInput): void {
  const { roots, contact, terrain, lod, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Root Geometry requires a non-empty rulesVersion.');
  }
  for (const currentLod of ['high', 'medium', 'low'] as const) {
    const vertices = config.maximumVerticesByLod[currentLod];
    const triangles = config.maximumTrianglesByLod[currentLod];
    if (!Number.isInteger(vertices) || vertices < 0) {
      throw new Error(`Tree Root Geometry ${currentLod} vertex budget must be a non-negative integer.`);
    }
    if (!Number.isInteger(triangles) || triangles < 0) {
      throw new Error(`Tree Root Geometry ${currentLod} triangle budget must be a non-negative integer.`);
    }
  }
  if (!(lod in config.maximumVerticesByLod) || !(lod in config.maximumTrianglesByLod)) {
    throw new Error(`Tree Root Geometry received unsupported LOD: ${String(lod)}.`);
  }
  if (roots.frames.diagnostics.branchCount !== roots.roots.length) {
    throw new Error('Tree Root Geometry root descriptors and canonical curves do not match.');
  }
  if (roots.frames.sourceRulesVersion !== roots.rulesVersion) {
    throw new Error('Tree Root Geometry received root frames from another rules version.');
  }
  if (contact) {
    if (contact.artifactSeed !== roots.artifactSeed) {
      throw new Error('Tree Root Geometry received Ground Contact from another artifact.');
    }
    if (contact.sourceRootArchitectureVersion !== roots.treeRootArchitectureVersion
      || contact.sourceRootRulesVersion !== roots.rulesVersion) {
      throw new Error('Tree Root Geometry Ground Contact provenance does not match accepted roots.');
    }
  }
  if (terrain) {
    if (!contact) {
      throw new Error('Tree Root Geometry requires Ground Contact before Terrain Binding.');
    }
    if (terrain.artifactSeed !== roots.artifactSeed) {
      throw new Error('Tree Root Geometry received Terrain Binding from another artifact.');
    }
    if (terrain.sourceGroundContactVersion !== contact.treeGroundContactVersion
      || terrain.sourceGroundContactRulesVersion !== contact.rulesVersion) {
      throw new Error('Tree Root Geometry Terrain Binding provenance does not match Ground Contact.');
    }
    if (terrain.lod !== lod) {
      throw new Error('Tree Root Geometry Terrain Binding LOD does not match root geometry LOD.');
    }
    if (terrain.groundLevelY !== contact.ground.levelY
      || terrain.binding.sourceBindingId !== contact.ground.terrainBindingId) {
      throw new Error('Tree Root Geometry Terrain Binding does not preserve the stable contact plane.');
    }
  }
}

/**
 * Комір з тієї самої деревини, що й стовбур.
 *
 * Він будується власним кільцевим кодом, не розгорткою, і доти малював ідеальні
 * кола. Відколи стовбур став лопатевим (`barkRelief`), його радіус на висоті
 * стику гуляє приблизно на ±14% навколо кола коміра — тобто деревина то виходить
 * назовні, то ховається всередину, і лінія їхнього перетину читається як шов
 * між пеньком і стовбуром. Рівний верхній радіус це не лікує: сходинки немає,
 * але хвиля лишається.
 *
 * Тож комір бере той самий рельєф, з фазою СТОВБУРА, а не власною: лопаті
 * мусять збігтися лопать у лопать, інакше два різні дерева зустрінуться на
 * одній висоті. Осьову координату міряємо від центру коміра — там же, звідки
 * розгортка починає рахувати довжину дуги стовбура.
 */
/**
 * Нижче семи корені перестають бути деревом.
 *
 * Не смак: у коментарі до `radialSegmentsByLod` записано, що на ШЕСТИ вони
 * читались «пласкими гострими шипами, що лежать на ґрунті, а не деревом, яке
 * входить у землю». Підгонка під бюджет має право спрощувати корені, але не
 * має права перетворювати їх на те, що вже одного разу відкинули.
 */
const ROOT_RADIAL_SEGMENT_FLOOR = 7;

function appendContactCollar(
  mesh: OrganicSweepMesh,
  contact: TreeGroundContactState,
  lod: OrganicMeshLod,
  bark: BarkReliefConfig,
): { mesh: OrganicSweepMesh; vertexCount: number; triangleCount: number } {
  const phase = barkReliefPhase(ORGANIC_TRUNK_BRANCH_ID);
  const segments = contact.collar.radialSegmentsByLod[lod];
  const ringCount = contact.collar.ringCount;
  const vertexOffset = mesh.positions.length / 3;
  const positions = [...mesh.positions];
  const normals = [...mesh.normals];
  const uvs = [...mesh.uvs];
  const indices = [...mesh.indices];
  const height = Math.max(1e-9, contact.collar.topY - contact.collar.bottomY);
  const radiusSpan = contact.collar.bottomRadius - contact.collar.topRadius;
  const profileExponent = contact.collar.profileExponent;

  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ring / (ringCount - 1);
    const remaining = 1 - t;
    const y = contact.collar.bottomY + height * t;
    const radius = contact.collar.topRadius
      + radiusSpan * Math.pow(remaining, profileExponent);
    // -dr/dy. It reaches zero at the top because exponent > 1, so the last
    // collar normals are radial like the lower trunk instead of announcing a
    // separate cone with a hard lighting seam.
    const inwardSlope = radiusSpan
      * profileExponent
      * Math.pow(remaining, profileExponent - 1)
      / height;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const relief = barkRelief(angle, y - contact.collar.center.y, radius, phase, bark);
      const shaped = radius * relief.radiusScale;
      positions.push(
        contact.collar.center.x + cosine * shaped,
        y,
        contact.collar.center.z + sine * shaped,
      );
      // Нахил нормалі на лопатеву поверхню — той самий, що в розгортці: радіальний
      // напрямок, відхилений до тангенційного на (∂r/∂θ)/r.
      const normal = normalize({
        x: cosine - (-sine) * relief.angularSlope,
        y: inwardSlope,
        z: sine - cosine * relief.angularSlope,
      });
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(segment / segments, t);
    }
  }

  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const lowerLeft = vertexOffset + ring * segments + segment;
      const lowerRight = vertexOffset + ring * segments + next;
      const upperLeft = vertexOffset + (ring + 1) * segments + segment;
      const upperRight = vertexOffset + (ring + 1) * segments + next;
      indices.push(lowerLeft, upperLeft, upperRight, lowerLeft, upperRight, lowerRight);
    }
  }

  const collarVertexCount = segments * ringCount;
  const collarTriangleCount = segments * (ringCount - 1) * 2;
  return {
    mesh: {
      ...mesh,
      positions,
      normals,
      uvs,
      indices,
      diagnostics: {
        ...mesh.diagnostics,
        ringCount: mesh.diagnostics.ringCount + ringCount,
        vertexCount: mesh.diagnostics.vertexCount + collarVertexCount,
        triangleCount: mesh.diagnostics.triangleCount + collarTriangleCount,
      },
    },
    vertexCount: collarVertexCount,
    triangleCount: collarTriangleCount,
  };
}

function appendTerrainSurface(
  mesh: OrganicSweepMesh,
  terrain: TreeTerrainBindingState,
): { mesh: OrganicSweepMesh; vertexCount: number; triangleCount: number } {
  const vertexOffset = mesh.positions.length / 3;
  const terrainVertexCount = terrain.diagnostics.vertexCount;
  const terrainTriangleCount = terrain.diagnostics.triangleCount;
  return {
    mesh: {
      ...mesh,
      positions: [...mesh.positions, ...terrain.mesh.positions],
      normals: [...mesh.normals, ...terrain.mesh.normals],
      uvs: [...mesh.uvs, ...terrain.mesh.uvs],
      indices: [
        ...mesh.indices,
        ...terrain.mesh.indices.map((index) => index + vertexOffset),
      ],
      diagnostics: {
        ...mesh.diagnostics,
        ringCount: mesh.diagnostics.ringCount + terrain.diagnostics.ringCount,
        vertexCount: mesh.diagnostics.vertexCount + terrainVertexCount,
        triangleCount: mesh.diagnostics.triangleCount + terrainTriangleCount,
      },
    },
    vertexCount: terrainVertexCount,
    triangleCount: terrainTriangleCount,
  };
}

/**
 * Pure static meshing step. Ground Contact replaces canonical roots with visible
 * prefixes, while Terrain Binding appends its heightfield to the same bark mesh.
 * Accepted roots, the stable contact plane and terrain identity remain immutable.
 */
export function buildTreeRootGeometry(
  input: BuildTreeRootGeometryInput,
): TreeRootGeometryState {
  validateInput(input);
  const { roots, contact, terrain, lod, config } = input;
  const sourceFrames = contact?.visibleRootFrames ?? roots.frames;
  const vertexBudget = config.maximumVerticesByLod[lod];
  const triangleBudget = config.maximumTrianglesByLod[lod];

  /*
   * БЮДЖЕТ, ЯКИЙ ТЕПЕР СТИСКАЄ, А НЕ ВИБУХАЄ.
   *
   * Було так: сітку будували раз, і якщо вона не влізла в бюджет — кидали
   * помилку. Портал ловить її й показує заглушку, тобто пара не бачить
   * СВОГО ДЕРЕВА ВЗАГАЛІ.
   *
   * І це не теорія. Виміряно на синтетичних історіях (12 подій на рік,
   * medium): на 6, 8 і 10 роках корені виходили 1 320, 1 347 і 1 365
   * трикутників проти бюджету 1 300 — тобто дерево падало на 1.5–5%
   * перевищення. На 7 роках воно проходило (1 068): справа не у віці як
   * такому, а в тому, яку форму дала кореням архітектура на цьому зерні.
   * Тобто в дорослого дерева це ОРЛЯНКА.
   *
   * Ніхто цього не бачив, бо приймальний тест будував лише фікстуру на
   * два з половиною роки, а вона в бюджет уміщається.
   *
   * Тепер бюджет — це стеля, під яку сітку ПІДГАНЯЮТЬ: радіальні сегменти
   * зменшуються від заданих у конфізі до підлоги, і береться перша сітка,
   * що влізла. Підлога — сім: у коментарі до `radialSegmentsByLod` уже
   * записано, що на шести корені читались «пласкими гострими шипами», і
   * ця межа лишається чинною.
   *
   * Кидати помилку рушій і далі вміє — але тільки якщо навіть на підлозі
   * не влізло. Тоді це справді поламаний контракт, а не велике дерево.
   *
   * Комір і терен від цього не страждають: у коміра власне джерело
   * сегментів (`contact.collar.radialSegmentsByLod`), а терен
   * прикладається готовим. Вони разом дають 420 трикутників сталої ваги,
   * решта — самі корені, тож 9 → 8 знімає рівно стільки, скільки треба
   * (945 → 840, разом 1 260).
   */
  const configuredSegments = config.surface.radialSegmentsByLod[lod];
  /*
   * Підлога НІКОЛИ не піднімає задане в конфізі.
   *
   * Перша редакція цього циклу писала `segments >= ROOT_RADIAL_SEGMENT_FLOOR`
   * і на `low` не робила жодної ітерації: там задано п'ять сегментів, тобто
   * менше за підлогу в сім. Змінна лишалась порожньою, а `attempt!` — моє ж
   * ствердження «тут не буває null» — ховало це від типів, доки не впав
   * власний тест на LOD. Підлога обмежує МОЄ спрощення, а не вибір конфігу:
   * якщо той свідомо просить грубші корені, він має рацію.
   */
  const segmentFloor = Math.min(configuredSegments, ROOT_RADIAL_SEGMENT_FLOOR);

  const attemptAt = (segments: number) => {
    const surface = segments === configuredSegments
      ? config.surface
      : {
        ...config.surface,
        radialSegmentsByLod: { ...config.surface.radialSegmentsByLod, [lod]: segments },
      };
    const builtMesh = buildOrganicSweepMesh(sourceFrames, lod, surface);
    const builtCollar = contact
      ? appendContactCollar(builtMesh, contact, lod, surface.bark)
      : { mesh: builtMesh, vertexCount: 0, triangleCount: 0 };
    const builtTerrain = terrain
      ? appendTerrainSurface(builtCollar.mesh, terrain)
      : { mesh: builtCollar.mesh, vertexCount: 0, triangleCount: 0 };
    return {
      mesh: builtTerrain.mesh,
      rawMesh: builtMesh,
      collarResult: builtCollar,
      terrainResult: builtTerrain,
      segments,
    };
  };

  let attempt = attemptAt(configuredSegments);
  for (let segments = configuredSegments - 1; segments >= segmentFloor; segments -= 1) {
    const fits = attempt.mesh.diagnostics.vertexCount <= vertexBudget
      && attempt.mesh.diagnostics.triangleCount <= triangleBudget;
    if (fits) break;
    attempt = attemptAt(segments);
  }

  const { mesh, rawMesh, collarResult, terrainResult } = attempt;
  const radialSegmentsUsed = attempt.segments;
  const expectedRootIds = roots.roots.map((root) => root.id);
  const renderedRootIds = rawMesh.branches.map((branch) => branch.branchId);
  const renderedRootSet = new Set(renderedRootIds);
  const expectedRootSet = new Set(expectedRootIds);
  const missingRootMeshIds = expectedRootIds.filter((id) => !renderedRootSet.has(id));
  const unexpectedMeshBranchIds = renderedRootIds.filter((id) => !expectedRootSet.has(id));
  const vertexBudgetExceeded = mesh.diagnostics.vertexCount > vertexBudget;
  const triangleBudgetExceeded = mesh.diagnostics.triangleCount > triangleBudget;

  if (missingRootMeshIds.length > 0 || unexpectedMeshBranchIds.length > 0) {
    throw new Error('Tree Root Geometry mesh provenance does not match accepted root IDs.');
  }
  if (vertexBudgetExceeded || triangleBudgetExceeded) {
    // Дійшли до підлоги радіальних сегментів і все одно не влізли. Це вже не
    // «велике дерево», а поламаний контракт — і тут помилка доречна.
    throw new Error(
      `Tree Root Geometry exceeded the ${lod} mobile mesh budget at `
        + `${radialSegmentsUsed} radial segments: `
        + `${mesh.diagnostics.vertexCount}/${vertexBudget} vertices, `
        + `${mesh.diagnostics.triangleCount}/${triangleBudget} triangles.`,
    );
  }

  return {
    treeRootGeometryVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceRootArchitectureVersion: roots.treeRootArchitectureVersion,
    sourceRootRulesVersion: roots.rulesVersion,
    sourceGroundContactVersion: contact?.treeGroundContactVersion ?? null,
    sourceGroundContactRulesVersion: contact?.rulesVersion ?? null,
    sourceTerrainBindingVersion: terrain?.treeTerrainBindingVersion ?? null,
    sourceTerrainBindingRulesVersion: terrain?.rulesVersion ?? null,
    artifactSeed: roots.artifactSeed,
    lod,
    mesh,
    diagnostics: {
      sourceRootCount: roots.roots.length,
      renderedRootCount: rawMesh.diagnostics.branchCount,
      vertexCount: mesh.diagnostics.vertexCount,
      triangleCount: mesh.diagnostics.triangleCount,
      estimatedDrawCalls: mesh.diagnostics.vertexCount > 0 ? 1 : 0,
      anchoredToGround: true,
      contactApplied: contact !== undefined,
      groundLevelY: contact?.ground.levelY ?? null,
      visiblePathFraction: contact?.diagnostics.visiblePathFraction ?? null,
      radialSegmentsConfigured: configuredSegments,
      /**
       * Скільки їх лишилось після підгонки під бюджет. Менше за
       * `radialSegmentsConfigured` означає, що дерево виросло настільки, що
       * корені довелось спростити — і це видно числом, а не здогадкою.
       */
      radialSegmentsUsed,
      collarVertexCount: collarResult.vertexCount,
      collarTriangleCount: collarResult.triangleCount,
      terrainApplied: terrain !== undefined,
      terrainVertexCount: terrainResult.vertexCount,
      terrainTriangleCount: terrainResult.triangleCount,
      terrainMergedIntoStaticMesh: terrain?.diagnostics.mergedIntoRootGeometry ?? false,
      vertexBudget,
      triangleBudget,
      vertexBudgetExceeded,
      triangleBudgetExceeded,
      missingRootMeshIds,
      unexpectedMeshBranchIds,
    },
  };
}
