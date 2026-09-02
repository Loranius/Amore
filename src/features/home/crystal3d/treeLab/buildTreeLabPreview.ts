import {
  DEFAULT_TREE_BARK_SURFACE_CONFIG,
  buildTreeBarkSurface,
  type TreeBarkSurfaceState,
} from '@/engine/barkSurface';
import {
  DEFAULT_TREE_CANOPY_DEPTH_CONFIG,
  buildTreeCanopyDepth,
  type TreeCanopyDepthState,
} from '@/engine/canopyDepth';
import {
  DEFAULT_TREE_CANOPY_LIGHT_CONFIG,
  buildTreeCanopyLight,
  type TreeCanopyLightState,
} from '@/engine/canopyLight';
import {
  DEFAULT_TREE_COMPOSITION_CONFIG,
  buildTreeComposition,
  type TreeCompositionState,
} from '@/engine/composition';
import {
  DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
  buildTreeCrownSilhouette,
  type TreeCrownSilhouetteState,
} from '@/engine/crownSilhouette';
import { stableHash32, type ArtifactBlueprint } from '@/engine/evolution';
import {
  DEFAULT_TREE_FOLIAGE_CONFIG,
  buildTreeFoliage,
  type TreeFoliageState,
} from '@/engine/foliage';
import {
  DEFAULT_TREE_GROUND_CONTACT_CONFIG,
  buildTreeGroundContact,
  type TreeGroundContactState,
} from '@/engine/groundContact';
import {
  DEFAULT_TREE_GROUND_DETAIL_CONFIG,
  buildTreeGroundDetail,
  type TreeGroundDetailState,
} from '@/engine/groundDetail';
import {
  DEFAULT_TREE_LEAF_GEOMETRY_CONFIG,
  buildTreeLeafGeometry,
  type TreeLeafGeometryState,
} from '@/engine/leafGeometry';
import {
  DEFAULT_TREE_LEAF_ORIENTATION_CONFIG,
  buildTreeLeafOrientation,
  type TreeLeafOrientationState,
} from '@/engine/leafOrientation';
import {
  DEFAULT_ORGANIC_SURFACE_CONFIG,
  buildOrganicCurveFrames,
  buildSelfOrganizingSkeleton,
  buildBudgetedOrganicSweepMesh,
  type OrganicCurveFrameState,
  type OrganicMeshLod,
  type OrganicSkeletonState,
  type BudgetedOrganicSweepMesh,
  type OrganicSweepMesh,
} from '@/engine/labs/organic';
import {
  DEFAULT_TREE_PHENOLOGY_CONFIG,
  buildTreePhenology,
  type TreePhenologyState,
} from '@/engine/phenology';
import {
  TREE_TRUNK_MAX_AXIAL_STRIDE,
  buildTreeProductionAcceptance,
  treeTrunkTriangleBudget,
  type TreeProductionAcceptanceState,
  type TreeProductionAsOfPolicy,
  type TreeProductionPhaseCheckpointInput,
  type TreeProductionPhaseId,
} from '@/engine/productionAcceptance';
import {
  DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG,
  buildTreeRootArchitecture,
  type TreeRootArchitectureState,
} from '@/engine/rootArchitecture';
import {
  DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
  buildTreeRootGeometry,
  type TreeRootGeometryState,
} from '@/engine/rootGeometry';
import {
  addTreeScaffoldBranches,
  applyTreeRootFlare,
  buildTreeSpeciesBlueprint,
  pruneThinTwigsForScaffolds,
  scaleFoliageConfigToAge,
  scaleLeafGeometryConfigToAge,
  scaleOrganicSurfaceToAge,
  scaleTreeSkeletonToAge,
  treeCrownNarrowing,
  treeDaysTogether,
  treeSlenderness,
  treeFoliageScale,
  treeSkeletonTargetHeight,
  treeToOrganicField,
  applyTreeCrownEnvelope,
  type TreeOrganicField,
  type TreeSpeciesBlueprint,
} from '@/engine/species/tree';
import {
  DEFAULT_TREE_SOIL_SURFACE_CONFIG,
  buildTreeSoilSurface,
  type TreeSoilSurfaceState,
} from '@/engine/soilSurface';
import {
  DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
  buildTreeTerrainBinding,
  type TreeTerrainBindingState,
} from '@/engine/terrainBinding';
import {
  DEFAULT_TREE_LIFE_CONFIG,
  buildTreeLifeState,
  type TreeLifeState,
} from '@/engine/treeLife';
import {
  DEFAULT_TREE_MATERIAL_CONFIG,
  buildTreeMaterialState,
  type TreeMaterialState,
} from '@/engine/treeMaterial';
import {
  buildTreeSpeciesPreviewArtifact,
  TREE_SPECIES_PREVIEW_AS_OF,
} from './treeSpeciesFixture';

const TREE_FIXTURE_RULES_VERSION = 'tree-species-preview-v1.0.0';


export interface TreeLabPreviewBuild {
  seed: number;
  lod: OrganicMeshLod;
  artifact: ArtifactBlueprint;
  species: TreeSpeciesBlueprint;
  field: TreeOrganicField;
  skeleton: OrganicSkeletonState;
  frames: OrganicCurveFrameState;
  composition: TreeCompositionState;
  roots: TreeRootArchitectureState;
  groundContact: TreeGroundContactState;
  terrain: TreeTerrainBindingState;
  rootGeometry: TreeRootGeometryState;
  foliage: TreeFoliageState;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
  canopyDepth: TreeCanopyDepthState;
  canopyLight: TreeCanopyLightState;
  phenology: TreePhenologyState;
  leafOrientation: TreeLeafOrientationState;
  crownSilhouette: TreeCrownSilhouetteState;
  soilSurface: TreeSoilSurfaceState;
  barkSurface: TreeBarkSurfaceState;
  groundDetails: TreeGroundDetailState;
  life: TreeLifeState;
  productionAcceptance: TreeProductionAcceptanceState;
  mesh: OrganicSweepMesh;
  /**
   * Як стовбур ужився зі своєю стелею: заданий крок, використаний крок,
   * сама стеля і чи не вліз навіть на найгрубішому кроці.
   *
   * Публікується, щоб «дерево стало простішим» було ЧИСЛОМ, а не здогадкою
   * з екрана — так само, як `radialSegmentsUsed` у коренів.
   */
  trunkBudget: BudgetedOrganicSweepMesh;
  /**
   * Множник довжин цього дерева проти дорослого — див. `ageScale.ts`.
   *
   * Публікується, бо без нього перевірити дерево неможливо: сталі листя,
   * згустків і кори — це довжини, і після закону віку вони значать
   * `конфіг × ageScale`, а не сам конфіг. Три чужі тести саме на цьому й
   * упали, і правильна відповідь була не послабити їх, а дати їм число.
   */
  ageScale: number;
  buildMs: number;
}

export interface BuildTreeLabPreviewFromArtifactInput {
  artifact: ArtifactBlueprint;
  asOf: string;
  lod: OrganicMeshLod;
  rulesVersion: string;
  asOfPolicy?: TreeProductionAsOfPolicy;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function scalarFingerprint(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  const directSignature = record['signature'];
  if (typeof directSignature === 'string' && directSignature.trim()) {
    return directSignature.trim();
  }

  const tokens: string[] = [];
  const visit = (prefix: string, source: Record<string, unknown>) => {
    for (const [key, entry] of Object.entries(source).sort(([left], [right]) => left.localeCompare(right))) {
      if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
        tokens.push(`${prefix}${key}:${String(entry)}`);
      } else if (Array.isArray(entry)) {
        tokens.push(`${prefix}${key}.length:${entry.length}`);
      }
    }
  };
  visit('', record);
  for (const nestedKey of ['descriptor', 'diagnostics', 'state', 'binding']) {
    const nested = record[nestedKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      visit(`${nestedKey}.`, nested as Record<string, unknown>);
    }
  }
  return stableHash32(tokens.join('\u001f')).toString(16).padStart(8, '0');
}

function rulesVersion(value: unknown, fallback: string): string {
  if (value && typeof value === 'object') {
    const candidate = (value as Record<string, unknown>)['rulesVersion'];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function checkpoint(
  id: TreeProductionPhaseId,
  value: unknown,
  fallbackRulesVersion: string,
): TreeProductionPhaseCheckpointInput {
  return {
    id,
    rulesVersion: rulesVersion(value, fallbackRulesVersion),
    fingerprint: scalarFingerprint(value),
  };
}

export function buildTreeLabPreviewFromArtifact({
  artifact,
  asOf,
  lod,
  rulesVersion: speciesRulesVersion,
  asOfPolicy = 'fixed-fixture',
}: BuildTreeLabPreviewFromArtifactInput): TreeLabPreviewBuild {
  const startedAt = now();
  const species = buildTreeSpeciesBlueprint({ artifact, config: { asOf, rulesVersion: speciesRulesVersion } });
  const field = treeToOrganicField(species);
  /*
   * Дерево росте самоорганізацією, а не просторовою колонізацією (ADR-0072).
   * Опублікований скелет має ту саму форму, тож усе нижче за течією —
   * кадри кривих, композиція, крона, корені, меш, бюджети — не змінилось.
   */
  /*
   * РОЗМІР — ЗАКОН ЧАСУ, ФОРМА — СИМУЛЯЦІЯ (ADR-0092).
   *
   * Симуляція чесно моделює конкуренцію за світло, а конкуренція скидає
   * гілки, тож її розмір гуляє: на порожній історії сорокарічне дерево
   * виходило нижчим за восьмирічне. Догма власника цього не допускає, тому
   * висоту скелета задає вік, а симуляція лишає собі форму.
   */
  const daysTogether = treeDaysTogether(artifact.relationshipStartedAt, asOf);
  const grown = scaleTreeSkeletonToAge(
    // Спершу вирішуємо, які гілки існують, і лише потім доводимо до висоти
    // закону: обрізання після масштабування знімало верхівку (ADR-0093 §8).
    pruneThinTwigsForScaffolds(
      buildSelfOrganizingSkeleton({ seed: field.seed, config: field.selfOrganizingConfig }),
      daysTogether,
    ),
    treeSkeletonTargetHeight(species.structure.trunkHeight),
    treeCrownNarrowing(daysTogether),
    treeSlenderness(daysTogether),
  );
  /*
   * ГІЛКИ-СКЕЛЕТИ ДОДАЮТЬСЯ, А НЕ ВИРОЩУЮТЬСЯ (ADR-0093).
   *
   * Самоорганізація їх не дає й дати не може: річна сила насичена, а гілок
   * більшає, тож бічний пагін не набирає навіть на одне міжвузля. Виміряно
   * — медіана довжини гілки 2-4% висоти на КОЖНОМУ віці. Власник: «додавай,
   * якщо їх немає, а їх немає, додавай».
   *
   * Після масштабування, а не до нього: довжина скелетної гілки — частка
   * висоти, яку дерево СПРАВДІ має за законом віку.
   */
  /*
   * КОМЕЛЬ — після закону товщини й ДО скелетних гілок: гілка бере товщину
   * свого комірця з вузла, до якого кріпиться, тож стовбур має бути вже
   * готовий (`rootFlare.ts`, ADR-0106).
   */
  /*
   * ОГИНАЛЬНА КРОНИ — ПІСЛЯ ОБРІЗАННЯ Й ПІСЛЯ ЗАКОНУ ВИСОТИ (ADR-0107 §2).
   *
   * Самоорганізація не має поняття крони: пагін іде туди, де світліше, і
   * зупиняється, коли бракує сили. Без стелі виходив стовп 0.32-0.34
   * завширшки від чверті зросту до самої маківки.
   *
   * ПОРЯДОК ТУТ ВИМІРЯНИЙ, А НЕ ВГАДАНИЙ, і мінявся він двічі.
   *
   * Спершу стеля стояла ДО обрізання — і не робила нічого: на сирому скелеті
   * вона чесно зводила верхівку з 0.31 на 0.07, але обрізання потім знімало
   * саме ту верхівку, дерево ставало нижчим, і те, що лишалось, знову міряло
   * 0.33 по всій висоті. Стеля мусить бачити ТУ висоту, яку дерево матиме.
   *
   * Потім вона стояла до скелетних гілок — і верхівка знову лишалась
   * пласкою, 0.37 при стелі 0.17. Причиною були не самі гілки (вони сидять
   * рівно на стелі, бо беруть ту саму огинальну), а БІЧНІ ПАГОНИ на них:
   * пагін відходить убік на 0.55 залишку гілки й виносив крону за оболонку.
   *
   * Тепер стеля — останнє, що робиться зі скелетом, і під неї підпадає все,
   * що в кроні є. Скелетні гілки від цього не рухаються взагалі: їхній
   * виліт І Є огинальна.
   */
  const skeleton = applyTreeCrownEnvelope(
    addTreeScaffoldBranches(
      applyTreeRootFlare(grown.skeleton),
      daysTogether,
      artifact.deterministicSeed,
    ),
    treeCrownNarrowing(daysTogether),
  );
  const frames = buildOrganicCurveFrames(skeleton);
  const composition = buildTreeComposition({ species, skeleton, frames, config: DEFAULT_TREE_COMPOSITION_CONFIG });
  const roots = buildTreeRootArchitecture({ species, composition, frames, config: DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG });
  const groundContact = buildTreeGroundContact({ species, roots, config: DEFAULT_TREE_GROUND_CONTACT_CONFIG });
  const terrain = buildTreeTerrainBinding({ species, contact: groundContact, lod, config: DEFAULT_TREE_TERRAIN_BINDING_CONFIG });
  const rootGeometry = buildTreeRootGeometry({ roots, contact: groundContact, terrain, lod, config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG });
  /*
   * Листя й згустки — теж довжини, тож і вони йдуть за віком. Інакше на
   * ростку заввишки 0.71 сидів би листок завдовжки 0.32.
   */
  /*
   * Округлюється ОДИН РАЗ і далі вживається саме округленим — і те саме
   * число публікується. Інакше конвеєр рахував би повною точністю, а тест,
   * що взяв опубліковане, — округленою, і згустки розходились би на 1e-6.
   * Рівно це й сталось: 0.035919 проти 0.035918.
   */
  const ageScale = Math.round(treeFoliageScale(species.structure.trunkHeight) * 1e6) / 1e6;
  const foliage = buildTreeFoliage({
    species,
    frames,
    composition,
    config: scaleFoliageConfigToAge(DEFAULT_TREE_FOLIAGE_CONFIG, ageScale),
  });
  const leaves = buildTreeLeafGeometry({
    foliage,
    lod,
    config: scaleLeafGeometryConfigToAge(DEFAULT_TREE_LEAF_GEOMETRY_CONFIG, ageScale),
  });
  const materials = buildTreeMaterialState({ species, composition, foliage, leaves, config: DEFAULT_TREE_MATERIAL_CONFIG });
  const canopyDepth = buildTreeCanopyDepth({ composition, foliage, leaves, materials, config: DEFAULT_TREE_CANOPY_DEPTH_CONFIG });
  const canopyLight = buildTreeCanopyLight({ composition, leaves, canopy: canopyDepth, materials, config: DEFAULT_TREE_CANOPY_LIGHT_CONFIG });
  const phenology = buildTreePhenology({
    species,
    leaves,
    canopyLight,
    materials,
    asOf,
    config: DEFAULT_TREE_PHENOLOGY_CONFIG,
  });
  const leafOrientation = buildTreeLeafOrientation({
    leaves,
    canopyDepth,
    canopyLight,
    phenology,
    config: DEFAULT_TREE_LEAF_ORIENTATION_CONFIG,
  });
  const crownSilhouette = buildTreeCrownSilhouette({
    composition,
    leaves,
    canopyDepth,
    canopyLight,
    phenology,
    leafOrientation,
    config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
  });
  const soilSurface = buildTreeSoilSurface({ species, terrain, rootGeometry, materials, config: DEFAULT_TREE_SOIL_SURFACE_CONFIG });
  /*
   * Стовбур тепер теж має стелю.
   *
   * Він був єдиним учасником дерева без неї: листя обмежене
   * `maxInstancesByLod`, корені стискаються під власний бюджет, дрібнота на
   * землі — під свою кількість, а стовбур просто ріс. Загальну стелю
   * перевіряли вже після складання й писали м'яке порушення, якого ніхто не
   * читав: виміряно, що його ламала кожна п'ята восьмирічна пара.
   *
   * Частка стовбура — не константа, а решта від загальної стелі після всіх,
   * у кого своя вже є (`treeTrunkTriangleBudget`).
   */
  const trunk = buildBudgetedOrganicSweepMesh(frames, lod, {
    maxTriangles: treeTrunkTriangleBudget(lod, {
      leafTriangles: leaves.diagnostics.renderedTriangleCount,
      rootTriangles: rootGeometry.diagnostics.triangleCount,
    }),
    maxAxialStride: TREE_TRUNK_MAX_AXIAL_STRIDE,
  }, scaleOrganicSurfaceToAge(DEFAULT_ORGANIC_SURFACE_CONFIG, grown.factor));
  const mesh = trunk.mesh;
  const barkSurface = buildTreeBarkSurface({
    species,
    frames,
    mesh,
    rootGeometry,
    soil: soilSurface,
    materials,
    config: DEFAULT_TREE_BARK_SURFACE_CONFIG,
  });
  const groundDetails = buildTreeGroundDetail({ species, terrain, soil: soilSurface, config: DEFAULT_TREE_GROUND_DETAIL_CONFIG });
  const life = buildTreeLifeState({ species, composition, leaves, materials, config: DEFAULT_TREE_LIFE_CONFIG });

  const totalVertices = mesh.diagnostics.vertexCount
    + rootGeometry.diagnostics.vertexCount
    + leaves.diagnostics.sharedVertexCount
    + groundDetails.diagnostics.sharedVertexCount;
  const totalTriangles = mesh.diagnostics.triangleCount
    + rootGeometry.diagnostics.triangleCount
    + leaves.diagnostics.renderedTriangleCount
    + groundDetails.diagnostics.renderedTriangleCount;
  const estimatedDrawCalls = 1
    + rootGeometry.diagnostics.estimatedDrawCalls
    + leaves.diagnostics.estimatedDrawCalls
    + groundDetails.diagnostics.estimatedDrawCalls;
  const totalMaterials = materials.diagnostics.uniqueMaterialCount
    + groundDetails.diagnostics.estimatedAdditionalMaterials;

  const productionAcceptance = buildTreeProductionAcceptance({
    coupleId: artifact.coupleId,
    artifactSeed: species.artifactSeed,
    lod,
    asOf,
    asOfPolicy,
    phases: [
      checkpoint('tree-species', species, speciesRulesVersion),
      checkpoint('organic-skeleton', skeleton, field.skeletonConfig.rulesVersion),
      checkpoint('curve-frames', frames, 'organic-curve-frames-v1.0.0'),
      checkpoint('tree-composition', composition, DEFAULT_TREE_COMPOSITION_CONFIG.rulesVersion),
      checkpoint('root-architecture', roots, DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG.rulesVersion),
      checkpoint('ground-contact', groundContact, DEFAULT_TREE_GROUND_CONTACT_CONFIG.rulesVersion),
      checkpoint('terrain-binding', terrain, DEFAULT_TREE_TERRAIN_BINDING_CONFIG.rulesVersion),
      checkpoint('root-geometry', rootGeometry, DEFAULT_TREE_ROOT_GEOMETRY_CONFIG.rulesVersion),
      checkpoint('foliage-architecture', foliage, DEFAULT_TREE_FOLIAGE_CONFIG.rulesVersion),
      checkpoint('leaf-geometry', leaves, DEFAULT_TREE_LEAF_GEOMETRY_CONFIG.rulesVersion),
      checkpoint('tree-material', materials, DEFAULT_TREE_MATERIAL_CONFIG.rulesVersion),
      checkpoint('canopy-depth', canopyDepth, DEFAULT_TREE_CANOPY_DEPTH_CONFIG.rulesVersion),
      checkpoint('canopy-light', canopyLight, DEFAULT_TREE_CANOPY_LIGHT_CONFIG.rulesVersion),
      checkpoint('phenology', phenology, DEFAULT_TREE_PHENOLOGY_CONFIG.rulesVersion),
      checkpoint('leaf-orientation', leafOrientation, DEFAULT_TREE_LEAF_ORIENTATION_CONFIG.rulesVersion),
      checkpoint('crown-silhouette', crownSilhouette, DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.rulesVersion),
      checkpoint('soil-surface', soilSurface, DEFAULT_TREE_SOIL_SURFACE_CONFIG.rulesVersion),
      checkpoint('bark-surface', barkSurface, DEFAULT_TREE_BARK_SURFACE_CONFIG.rulesVersion),
      checkpoint('ground-detail', groundDetails, DEFAULT_TREE_GROUND_DETAIL_CONFIG.rulesVersion),
      checkpoint('tree-life', life, DEFAULT_TREE_LIFE_CONFIG.rulesVersion),
    ],
    identities: {
      sourceLeafIds: leaves.instances.map((leaf) => leaf.id),
      canopyDepthLeafIds: canopyDepth.profiles.map((profile) => profile.leafInstanceId),
      canopyLightLeafIds: canopyLight.profiles.map((profile) => profile.leafInstanceId),
      phenologyLeafIds: phenology.profiles.map((profile) => profile.leafInstanceId),
      leafOrientationLeafIds: leafOrientation.profiles.map((profile) => profile.leafInstanceId),
      crownSilhouetteLeafIds: crownSilhouette.profiles.map((profile) => profile.leafInstanceId),
      lifeLeafIds: life.leaves.map((profile) => profile.leafInstanceId),
    },
    preservation: {
      negativeSpaceAccepted: crownSilhouette.diagnostics.negativeSpaceAccepted,
      groundAnchored: rootGeometry.diagnostics.anchoredToGround,
      terrainMergedIntoStaticGeometry: rootGeometry.diagnostics.terrainMergedIntoStaticMesh,
      soilTerrainTintPreserved: barkSurface.diagnostics.soilTerrainTintPreserved,
      barkGeometryPreserved: barkSurface.diagnostics.geometryPreserved
        && barkSurface.diagnostics.branchRangesPreserved,
      groundDetailsAnchored: groundDetails.diagnostics.anchoredToTerrain,
      groundDetailPrefixPreserved: groundDetails.diagnostics.stablePrefixPreserved,
    },
    budgets: {
      vertices: totalVertices,
      triangles: totalTriangles,
      estimatedDrawCalls,
      materials: totalMaterials,
      leafInstances: leaves.instances.length,
      estimatedMatrixUpdatesPerFrame: life.diagnostics.estimatedMatrixUpdatesPerFrame,
    },
  });
  const buildMs = now() - startedAt;

  return {
    seed: field.seed,
    lod,
    artifact,
    species,
    field,
    skeleton,
    frames,
    composition,
    roots,
    groundContact,
    terrain,
    rootGeometry,
    foliage,
    leaves,
    materials,
    canopyDepth,
    canopyLight,
    phenology,
    leafOrientation,
    crownSilhouette,
    soilSurface,
    barkSurface,
    groundDetails,
    life,
    productionAcceptance,
    trunkBudget: trunk,
    mesh,
    ageScale,
    buildMs,
  };
}

export function buildTreeLabPreview(lod: OrganicMeshLod): TreeLabPreviewBuild {
  return buildTreeLabPreviewFromArtifact({
    artifact: buildTreeSpeciesPreviewArtifact(),
    asOf: TREE_SPECIES_PREVIEW_AS_OF,
    lod,
    rulesVersion: TREE_FIXTURE_RULES_VERSION,
    asOfPolicy: 'fixed-fixture',
  });
}
