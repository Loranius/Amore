import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREE_COMPOSITION_CONFIG,
  buildTreeComposition,
} from '../composition';
import { buildOrganicCurveFrames } from '../labs/organic';
import { scaleFoliageConfigToAge } from '@/engine/species/tree';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_FOLIAGE_CONFIG } from './config';
import { buildTreeFoliage } from './treeFoliage';

describe('Tree Foliage', () => {
  it('is deterministic and stays inside the mobile canopy budget', () => {
    const first = buildTreeLabPreview('medium').foliage;
    const second = buildTreeLabPreview('medium').foliage;

    expect(second).toEqual(first);
    expect(first.clusters.length).toBeGreaterThan(0);
    expect(first.clusters.length).toBeLessThanOrEqual(DEFAULT_TREE_FOLIAGE_CONFIG.maxClusters);
    expect(first.diagnostics.totalLeafCount).toBeLessThanOrEqual(
      DEFAULT_TREE_FOLIAGE_CONFIG.maxLeaves,
    );
    expect(first.diagnostics.emittedClusterCount).toBe(first.clusters.length);
    expect(first.diagnostics.occupiedCellIds).toEqual(
      [...first.diagnostics.occupiedCellIds].sort(),
    );
  });

  it('emits normalized local cluster data outside the branch surface', () => {
    const build = buildTreeLabPreview('medium');

    const samplesById = new Map(
      build.frames.curves.flatMap((curve) => (
        curve.samples.map((sample) => [sample.id, sample] as const)
      )),
    );

    for (const cluster of build.foliage.clusters) {
      /*
       * Стовбур тепер теж носить листя — але лише на молодій верхівці, а не
       * на голій корі внизу (ADR-0075). Бічні гілки лишаються від першого
       * покоління й вище.
       */
      if (cluster.role === 'trunk') {
        const sample = samplesById.get(cluster.sourceSampleId);
        expect(sample).toBeDefined();
        expect(sample!.normalizedDistance).toBeGreaterThanOrEqual(
          DEFAULT_TREE_FOLIAGE_CONFIG.trunkTerminalStart,
        );
      } else {
        expect(cluster.generation).toBeGreaterThanOrEqual(1);
      }
      /*
       * Смуга радіуса помножена на `ageScale`, і це не послаблення тесту, а
       * саме те, що він мусить перевіряти після ADR-0092: розмір дерева —
       * закон часу, тож `minClusterRadius` у конфізі означає «на дорослому
       * дереві». На фікстурі віком два з половиною роки згусток 0.14
       * дорівнював би чверті самого дерева.
       */
      expect(cluster.radius).toBeGreaterThanOrEqual(
        DEFAULT_TREE_FOLIAGE_CONFIG.minClusterRadius * build.ageScale - 1e-6,
      );
      expect(cluster.radius).toBeLessThanOrEqual(
        DEFAULT_TREE_FOLIAGE_CONFIG.maxClusterRadius * build.ageScale + 1e-6,
      );
      expect(cluster.density).toBeGreaterThanOrEqual(0);
      expect(cluster.density).toBeLessThanOrEqual(1);
      expect(cluster.leafCount).toBeGreaterThanOrEqual(
        DEFAULT_TREE_FOLIAGE_CONFIG.minLeavesPerCluster,
      );
      expect(cluster.leafCount).toBeLessThanOrEqual(
        DEFAULT_TREE_FOLIAGE_CONFIG.maxLeavesPerCluster,
      );
      expect(Math.hypot(cluster.direction.x, cluster.direction.y, cluster.direction.z)).toBeCloseTo(1, 5);
      expect(Math.hypot(cluster.normal.x, cluster.normal.y, cluster.normal.z)).toBeCloseTo(1, 5);
    }
  });

  it('fills interior branch spans instead of publishing only terminal-tip foliage', () => {
    const build = buildTreeLabPreview('medium');
    const samplesById = new Map(
      build.frames.curves.flatMap((curve) => (
        curve.samples.map((sample) => [sample.id, sample] as const)
      )),
    );
    const normalizedDistances = build.foliage.clusters
      .map((cluster) => samplesById.get(cluster.sourceSampleId)?.normalizedDistance)
      .filter((value): value is number => value !== undefined);
    const interiorClusters = normalizedDistances.filter((distance) => distance < 0.58);

    expect(normalizedDistances).toHaveLength(build.foliage.clusters.length);
    expect(Math.min(...normalizedDistances)).toBeLessThan(0.5);
    expect(interiorClusters.length).toBeGreaterThanOrEqual(
      Math.ceil(build.foliage.clusters.length * 0.2),
    );
    expect(build.foliage.diagnostics.occupiedCellIds.length).toBeGreaterThanOrEqual(4);
    expect(build.leaves.diagnostics.clusterIdsWithoutInstances).toEqual([]);
    expect(build.leaves.instances.length).toBeGreaterThanOrEqual(
      Math.floor(build.foliage.diagnostics.totalLeafCount * 0.68),
    );
  });

  /*
   * ЖОДНОЇ ГОЛОЇ ГІЛКИ — і саме цього не було видно жодному тесту, поки
   * дерево не зняли з екрана.
   *
   * До ADR-0075 бюджет листя вичерпувався на 43-му згустку з 140, і 32 гілки
   * з 50 не діставали жодного листка: крона читалась помпонами на палицях.
   * Усі числа тут стояли «правильні» — стелі не перевищено, детермінізм
   * тримався, — бо ЖОДЕН тест не питав, чи листя ДІСТАЛОСЬ УСІМ.
   */
  it('leaves no eligible branch bare', () => {
    const build = buildTreeLabPreview('medium');

    expect(build.foliage.diagnostics.branchIdsWithoutFoliage).toEqual([]);
  });

  /*
   * ВЕРХІВКА НЕ ХВОРОСТИНА. До ADR-0075 верх дерева пари стояв на 4.44, а
   * найвищий згусток листя — на 3.82: гола сьома частина висоти. Причиною був
   * НЕ стовбур, а бюджет: до наймолодших гілок листя просто не доходило, бо
   * весь запас з'їдали перші сорок три згустки.
   *
   * Перевірено мутацією: із поверненим бюджетом 12-20 листків цей тест падає.
   * Поріг у 7% висоти — молодий приріст останніх сантиметрів голий і в
   * природі, а от сьома частина висоти — ні.
   */
  it('carries foliage to the top of the tree', () => {
    const build = buildTreeLabPreview('medium');
    const topY = Math.max(...build.skeleton.nodes.map((node) => node.position.y));
    const groundY = Math.min(...build.skeleton.nodes.map((node) => node.position.y));
    const highestCluster = Math.max(...build.foliage.clusters.map((c) => c.position.y));

    expect(topY - highestCluster).toBeLessThan((topY - groundY) * 0.07);
  });

  /*
   * САМ СТОВБУР ТЕЖ ОБЛИСТЯНИЙ — угорі.
   *
   * Стовбур був виключений із листя ТИПОМ (`Exclude<TreeCompositionRole,
   * 'trunk'>`), тож його верхня частина лишалась голою жердиною, повз яку
   * листя росло тільки збоку. Виміряно: три згустки на висотах 2.85, 3.26 і
   * 3.82 — саме та ділянка стовбура, що була порожньою.
   *
   * Нижня частина стовбура мусить лишатись голою: там кора, і це навмисно.
   */
  it('leafs the upper stem but keeps the lower trunk bare', () => {
    const build = buildTreeLabPreview('medium');
    const samplesById = new Map(
      build.frames.curves.flatMap((curve) => (
        curve.samples.map((sample) => [sample.id, sample] as const)
      )),
    );
    const trunkClusters = build.foliage.clusters.filter((cluster) => cluster.role === 'trunk');

    expect(trunkClusters.length).toBeGreaterThan(0);
    for (const cluster of trunkClusters) {
      expect(samplesById.get(cluster.sourceSampleId)!.normalizedDistance)
        .toBeGreaterThanOrEqual(DEFAULT_TREE_FOLIAGE_CONFIG.trunkTerminalStart);
    }
  });

  /*
   * ЖОДНОГО ГОЛОГО КІНЧИКА. Згустки ставали на 0.475, 0.65 і 0.825 довжини
   * гілки, тож зовнішня шоста частина кожної гілки лишалась палицею —
   * виміряно 33 голих кінчики з 50. У природі кінчик найлистяніший, бо він
   * наймолодший.
   *
   * Поріг 0.35 одиниці сцени — приблизно два радіуси згустка: якщо ближче за
   * це листя немає, кінчик голий і оком.
   */
  it('leaves no branch tip bare', () => {
    const build = buildTreeLabPreview('medium');
    const bare = build.frames.curves.filter((curve) => {
      const branch = build.composition.branches.find((b) => b.branchId === curve.branchId);
      if (!branch || branch.role === 'trunk') return false;
      const tip = curve.samples[curve.samples.length - 1]!.position;
      return !build.foliage.clusters.some((cluster) => Math.hypot(
        cluster.position.x - tip.x,
        cluster.position.y - tip.y,
        cluster.position.z - tip.z,
      ) < 0.35);
    });

    expect(bare.map((curve) => curve.branchId)).toEqual([]);
  });

  it('does not mutate species, frames or composition', () => {
    const build = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(build.species);
    const framesBefore = JSON.stringify(build.frames);
    const compositionBefore = JSON.stringify(build.composition);

    buildTreeFoliage({
      species: build.species,
      frames: build.frames,
      composition: build.composition,
      // Той самий закон віку, що й у конвеєра, — інакше порівнювали б
      // дерево із законом проти дерева без нього (ADR-0092).
      config: scaleFoliageConfigToAge(DEFAULT_TREE_FOLIAGE_CONFIG, build.ageScale),
    });

    expect(JSON.stringify(build.species)).toBe(speciesBefore);
    expect(JSON.stringify(build.frames)).toBe(framesBefore);
    expect(JSON.stringify(build.composition)).toBe(compositionBefore);
  });

  it('keeps earlier cluster identities and placement stable without later branches', () => {
    const full = buildTreeLabPreview('medium');
    const prefixCurves = full.frames.curves.slice(0, Math.min(8, full.frames.curves.length));
    const retainedBranchIds = new Set(prefixCurves.map((curve) => curve.branchId));
    retainedBranchIds.add('organic:trunk');
    const partialNodes = full.skeleton.nodes.filter(
      (node) => retainedBranchIds.has(node.branchId),
    );
    const partialSkeleton = {
      ...full.skeleton,
      nodes: partialNodes,
      diagnostics: {
        ...full.skeleton.diagnostics,
        maxGeneration: Math.max(0, ...partialNodes.map((node) => node.generation)),
      },
    };
    const partialFrames = buildOrganicCurveFrames(partialSkeleton);
    const partialComposition = buildTreeComposition({
      species: full.species,
      skeleton: partialSkeleton,
      frames: partialFrames,
      config: DEFAULT_TREE_COMPOSITION_CONFIG,
    });
    const partialFoliage = buildTreeFoliage({
      species: full.species,
      frames: partialFrames,
      composition: partialComposition,
      // Той самий закон віку, що й у конвеєра, — інакше порівнювали б
      // дерево із законом проти дерева без нього (ADR-0092).
      config: scaleFoliageConfigToAge(DEFAULT_TREE_FOLIAGE_CONFIG, full.ageScale),
    });
    const fullById = new Map(
      full.foliage.clusters.map((cluster) => [cluster.id, cluster] as const),
    );

    for (const cluster of partialFoliage.clusters) {
      /*
       * `sequence` виключено, як і в сусідній перевірці обрізання: це номер
       * у ПОРЯДКУ ВИПУСКУ, а цей тест саме порядок і міняє, забираючи гілки.
       *
       * Відколи бюджет роздається двома проходами — по одному згустку кожній
       * гілці, потім решта (ADR-0101) — номер згустка залежить від того,
       * скільки гілок узагалі є. Це не втрата стабільності: сама тотожність
       * згустка (`id`), його місце в просторі, радіус, густота й гілка, на
       * якій він сидить, лишаються тими самими. Саме їх тест і стереже.
       */
      const { sequence: _partialSequence, ...stable } = cluster;
      const { sequence: _fullSequence, ...expected } = fullById.get(cluster.id)!;
      expect(expected).toEqual(stable);
    }
  });

  it('truncates only later candidates when budgets are constrained', () => {
    const build = buildTreeLabPreview('medium');
    const constrained = buildTreeFoliage({
      species: build.species,
      frames: build.frames,
      composition: build.composition,
      config: {
        ...scaleFoliageConfigToAge(DEFAULT_TREE_FOLIAGE_CONFIG, build.ageScale),
        maxClusters: 4,
        maxLeaves: 60,
      },
    });

    expect(constrained.clusters.length).toBeLessThanOrEqual(4);
    expect(constrained.diagnostics.totalLeafCount).toBeLessThanOrEqual(60);
    expect(constrained.diagnostics.truncatedClusterIds.length).toBeGreaterThan(0);
    for (const cluster of constrained.clusters) {
      const source = build.foliage.clusters.find((candidate) => candidate.id === cluster.id);
      expect(source).toBeDefined();
      const { sequence: _constrainedSequence, ...stableCluster } = cluster;
      const { sequence: _sourceSequence, ...stableSource } = source!;
      expect(stableCluster).toEqual(stableSource);
    }
  });
});
