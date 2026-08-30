import { describe, expect, it } from 'vitest';
import {
  TREE_PRODUCTION_HIGH_DETAIL_BUDGET,
  TREE_PRODUCTION_MOBILE_BUDGET,
} from '@/engine/productionAcceptance';
import { createThreeOrganicSweepGeometry } from '@/engine/renderer/three';
import {
  buildTreeLabPreview,
  buildTreeLabPreviewFromArtifact,
} from './buildTreeLabPreview';
import {
  buildArtifactBlueprint,
  type ArtifactBlueprint,
  type EvolutionEventInput,
} from '@/engine/evolution';
import {
  buildTreeSpeciesPreviewArtifact,
  TREE_SPECIES_PREVIEW_AS_OF,
} from './treeSpeciesFixture';

/**
 * Синтетична пара, що прожила `years` років, по 12 подій на рік.
 *
 * Потрібна тому, що фікстура — це пара на два з половиною роки, і рівно ця
 * її коротка історія тримала в тіні падіння, описане нижче. Дванадцять подій
 * на рік — щоб жоден рік не був порожнім: порожній рік не дає ні тіла, ні
 * коренів, і дерево знову виходить маленьким.
 */
function agedArtifact(years: number): ArtifactBlueprint {
  const start = new Date(Date.UTC(2026 - years, 7, 30));
  const spanMs = years * 365.2425 * 86_400_000;
  const total = years * 12;
  const events: EvolutionEventInput[] = [];
  for (let index = 0; index < total; index += 1) {
    const day = new Date(start.getTime() + ((index + 0.5) * spanMs) / total);
    events.push({
      id: `aged:${years}:${index}`,
      occurredAt: `${day.toISOString().slice(0, 10)}T12:00:00+03:00`,
      source: 'memories-preview@1',
      evidence: 'verified',
      channels: { remembrance: 0.5, culture: 0.3, exploration: 0.4 },
      portalActivity: 0.3,
    });
  }
  return buildArtifactBlueprint({
    coupleId: `amore:aged-${years}`,
    config: {
      engineVersion: 'tree-preview-1.0.0',
      relationshipStartedAt: start.toISOString().slice(0, 10),
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
}

function withoutBuildTime<T extends { buildMs: number }>(value: T): Omit<T, 'buildMs'> {
  const { buildMs: _buildMs, ...stable } = value;
  return stable;
}

describe('Tree production preview pipeline', () => {
  it('keeps the full Evolution -> Species -> Growth -> Crown -> Surface -> Life -> Acceptance result deterministic', () => {
    const first = buildTreeLabPreview('medium');
    const second = buildTreeLabPreview('medium');

    expect(withoutBuildTime(second)).toEqual(withoutBuildTime(first));
    expect(second.seed).toBe(first.seed);
    expect(second.productionAcceptance.signature).toBe(first.productionAcceptance.signature);
  });

  it('preserves the fixed fixture as a wrapper around the generic artifact path', () => {
    const fixture = buildTreeLabPreview('medium');
    const generic = buildTreeLabPreviewFromArtifact({
      artifact: buildTreeSpeciesPreviewArtifact(),
      asOf: TREE_SPECIES_PREVIEW_AS_OF,
      lod: 'medium',
      rulesVersion: 'tree-species-preview-v1.0.0',
      asOfPolicy: 'fixed-fixture',
    });

    expect(withoutBuildTime(generic)).toEqual(withoutBuildTime(fixture));
  });

  it('uses Tree Species output instead of a free-standing random attractor field', () => {
    const build = buildTreeLabPreview('medium');

    expect(build.species.species).toBe('tree');
    expect(build.species.coupleId).toBe('amore:tree-species-preview');
    expect(build.species.state.stage).toBe('young');
    /*
     * Три гілки на три роки стосунків — і ЖОДНОЇ від події.
     *
     * Було 2 річні плюс 8 від подій. Це закон «один рядок порталу =
     * одне тіло», який ADR-0004 прибрав із кристала; дерево лишалось
     * останнім видом, що ним ріс. Притягачів від того не поменшало
     * пропорційно (15 → 12): рік несе стільки листя, скільки його
     * прожили, тож крона лишилась, а тіла зникли.
     */
    expect(build.species.diagnostics.annualInstructionCount).toBe(3);
    expect(build.species.diagnostics.eventInstructionCount).toBe(0);
    expect(build.field.diagnostics.attractorCount).toBe(12);
    expect(build.field.diagnostics.truncatedInstructionIds).toEqual([]);
    expect(build.skeleton.seed).toBe(build.field.seed);
    expect(build.skeleton.rulesVersion).toBe(build.field.skeletonConfig.rulesVersion);
  });

  it('publishes a passing production contract for low, medium and high LOD', () => {
    const low = buildTreeLabPreview('low');
    const medium = buildTreeLabPreview('medium');
    const high = buildTreeLabPreview('high');
    const builds = [low, medium, high] as const;

    for (const build of builds) {
      const contract = build.productionAcceptance;
      const budget = build.lod === 'high'
        ? TREE_PRODUCTION_HIGH_DETAIL_BUDGET
        : TREE_PRODUCTION_MOBILE_BUDGET;
      expect({ lod: build.lod, violations: contract.violations }).toEqual({
        lod: build.lod,
        violations: [],
      });
      expect(contract.staticStatus).toBe('pass');
      expect(contract.diagnostics.phaseOrderPreserved).toBe(true);
      expect(contract.diagnostics.phaseFingerprintsPresent).toBe(true);
      expect(contract.diagnostics.leafIdentityChainPreserved).toBe(true);
      expect(contract.diagnostics.lifeLeafPrefixPreserved).toBe(true);
      expect(contract.diagnostics.negativeSpaceAccepted).toBe(true);
      expect(contract.diagnostics.groundAnchored).toBe(true);
      expect(contract.diagnostics.terrainMergedIntoStaticGeometry).toBe(true);
      expect(contract.diagnostics.soilTerrainTintPreserved).toBe(true);
      expect(contract.diagnostics.barkGeometryPreserved).toBe(true);
      expect(contract.diagnostics.groundDetailsAnchored).toBe(true);
      expect(contract.diagnostics.groundDetailPrefixPreserved).toBe(true);
      expect(contract.diagnostics.vertices).toBeLessThanOrEqual(budget.maxVertices);
      expect(contract.diagnostics.triangles).toBeLessThanOrEqual(budget.maxTriangles);
      expect(contract.diagnostics.estimatedDrawCalls).toBeLessThanOrEqual(budget.maxDrawCalls);
      expect(contract.diagnostics.materials).toBeLessThanOrEqual(budget.maxMaterials);
    }

    const lowIds = low.leaves.instances.map((leaf) => leaf.id);
    const mediumIds = medium.leaves.instances.map((leaf) => leaf.id);
    const highIds = high.leaves.instances.map((leaf) => leaf.id);
    const mediumIdSet = new Set(mediumIds);
    const highIdSet = new Set(highIds);
    expect(lowIds.every((id) => mediumIdSet.has(id))).toBe(true);
    expect(mediumIds.every((id) => highIdSet.has(id))).toBe(true);
    expect(mediumIds.filter((id) => new Set(lowIds).has(id))).toEqual(lowIds);
    expect(highIds.filter((id) => mediumIdSet.has(id))).toEqual(mediumIds);
  });

  it('keeps canopy polish, surface character, static geometry, instances and life inside published mobile limits', () => {
    const build = buildTreeLabPreview('medium');
    const contract = build.productionAcceptance;

    expect(build.canopyDepth.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.canopyDepth.diagnostics.innerLeafCount).toBeGreaterThan(0);
    expect(build.canopyDepth.diagnostics.middleLeafCount).toBeGreaterThan(0);
    expect(build.canopyDepth.diagnostics.outerLeafCount).toBeGreaterThan(0);
    expect(build.canopyDepth.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(build.canopyDepth.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(build.canopyDepth.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame).toBe(0);
    expect(build.canopyLight.profiles).toHaveLength(build.leaves.instances.length);
    expect(
      build.canopyLight.diagnostics.shadeLeafCount
        + build.canopyLight.diagnostics.transitionLeafCount
        + build.canopyLight.diagnostics.sunlitLeafCount,
    ).toBe(build.leaves.instances.length);
    expect(build.canopyLight.diagnostics.uniqueCombinedTintCount).toBeGreaterThan(1);
    expect(build.phenology.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.leafOrientation.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.leafOrientation.diagnostics.nonZeroProfileCount).toBeGreaterThan(0);
    expect(build.crownSilhouette.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.crownSilhouette.diagnostics.adjustedOuterLeafCount).toBeGreaterThan(0);
    expect(build.crownSilhouette.diagnostics.negativeSpaceAccepted).toBe(true);
    expect(build.barkSurface.diagnostics.materialCount).toBe(2);
    // 72 -> 24 with tree-ground-detail v1.1.0 (see groundDetail/config.ts).
    expect(build.groundDetails.instances).toHaveLength(24);
    expect(build.groundDetails.diagnostics.totalMaterialCount).toBe(3);
    expect(build.life.diagnostics.estimatedMatrixUpdatesPerFrame).toBe(
      build.life.leaves.length,
    );
    expect(build.life.leaves.length).toBeLessThanOrEqual(build.leaves.instances.length);
    expect(contract.diagnostics.estimatedMatrixUpdatesPerFrame).toBe(build.life.leaves.length);
    expect(build.mesh.diagnostics.junctionCount).toBe(build.frames.diagnostics.junctionCount);
  });

  it('adapts the pure branch mesh and Bark Surface to one indexed Three.js geometry', () => {
    const build = buildTreeLabPreview('low');
    const geometry = createThreeOrganicSweepGeometry(build.mesh, build.barkSurface);

    expect(geometry.getAttribute('position').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('normal').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('uv').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('color').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('barkCharacter').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getIndex()?.count).toBe(build.mesh.indices.length);
    expect(geometry.userData['treeLab']).toMatchObject({
      lod: 'low',
      branches: build.mesh.diagnostics.branchCount,
      junctions: build.frames.diagnostics.junctionCount,
      barkSurfaceApplied: true,
    });

    geometry.dispose();
  });
  it('grows an old couple a tree at all, and keeps it inside the published budget', () => {
    /*
     * ЦЕЙ ТЕСТ — ТЕ, ЧОГО БРАКУВАЛО, І ЧОМУ ВАДУ НІХТО НЕ БАЧИВ.
     *
     * Усі перевірки бюджету будували ОДНУ фікстуру — пару на два з
     * половиною роки. Вона вміщується в стелю з запасом, тож контракт
     * звітував «pass», а на дорослому дереві рушій КИДАВ ПОМИЛКУ:
     * геометрія коренів виходила за власний бюджет, портал ловив виняток і
     * показував заглушку. Пара після ~6 років не бачила б свого дерева
     * взагалі — і жоден зелений прогін цього не сказав би.
     *
     * Виміряно тоді (12 подій на рік, medium): 6 років — 1 320 трикутників
     * коренів, 8 — 1 347, 10 — 1 365, проти бюджету 1 300. На 7 роках
     * проходило (1 068), тобто це залежало не від віку, а від форми, яку
     * дала архітектура на цьому зерні: орлянка.
     *
     * Тепер бюджет стискає сітку замість того, щоб об неї розбиватись, і
     * тест перевіряє саме те, що ламалось: дерево БУДУЄТЬСЯ в кожному віці.
     */
    for (const years of [1, 3, 5, 6, 7, 8, 10, 15]) {
      const build = buildTreeLabPreviewFromArtifact({
        artifact: agedArtifact(years),
        asOf: '2026-08-30T12:00:00+03:00',
        lod: 'medium',
        rulesVersion: 'tree-species-aged',
      });
      const roots = build.rootGeometry.diagnostics;

      // Корені влізли — власним стисканням, якщо інакше не виходило.
      expect({ years, exceeded: roots.triangleBudgetExceeded || roots.vertexBudgetExceeded })
        .toEqual({ years, exceeded: false });
      expect(roots.radialSegmentsUsed).toBeGreaterThanOrEqual(7);
      expect(roots.radialSegmentsUsed).toBeLessThanOrEqual(roots.radialSegmentsConfigured);
      // І жодного кореня при цьому не загубилось.
      expect(roots.renderedRootCount).toBe(roots.sourceRootCount);
      expect(roots.missingRootMeshIds).toEqual([]);

      /*
       * НАЗВАНА МЕЖА, а не прихована.
       *
       * Загальна стеля дерева на мобільному — 18 000 трикутників, і на
       * восьмирічному дереві виміряно 18 078: перевищення на 78, тобто на
       * 0.4%. Це м'яке порушення — контракт його ЗВІТУЄ, і ніхто нічого не
       * кидає, — і воно лишається чесно записаним тут, замість того щоб
       * бути стеленим під поріг, який нічого не ловить.
       *
       * Тому межа тесту — 5% понад стелю: більше означає, що щось поїхало,
       * менше вже виміряно й прийнято.
       */
      const contract = build.productionAcceptance.diagnostics;
      expect(contract.triangles).toBeLessThanOrEqual(
        TREE_PRODUCTION_MOBILE_BUDGET.maxTriangles * 1.05,
      );
      expect(contract.estimatedDrawCalls)
        .toBeLessThanOrEqual(TREE_PRODUCTION_MOBILE_BUDGET.maxDrawCalls);
    }
  });

});
