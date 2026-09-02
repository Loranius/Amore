import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import {
  buildTreeLabPreview,
  buildTreeLabPreviewFromArtifact,
} from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG } from './config';
import { buildTreeCrownSilhouette } from './treeCrownSilhouette';

function rebuild(lod: 'high' | 'medium' | 'low' = 'medium') {
  const build = buildTreeLabPreview(lod);
  return {
    build,
    silhouette: buildTreeCrownSilhouette({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
      config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
    }),
  };
}

/**
 * Доросле дерево — двадцять років, по дванадцять подій на рік.
 *
 * Потрібне тому, що затягування листя всередину працює лише на кроні, яка
 * СПРАВДІ відходить убік, а фікстура — пара на два з половиною роки. Відколи
 * ширина крони стала законом віку (ADR-0097), молоде дерево вузьке за
 * побудовою: 0.60 висоти проти 1.27 у сорокарічного. Це не втрата покриття,
 * а перенесення перевірки туди, де механізм узагалі має спрацьовувати.
 */
function spreadingCrown() {
  const years = 20;
  const start = new Date(Date.UTC(2026 - years, 7, 30));
  const spanMs = years * 365.2425 * 86_400_000;
  const events: EvolutionEventInput[] = [];
  for (let index = 0; index < years * 12; index += 1) {
    const day = new Date(start.getTime() + ((index + 0.5) * spanMs) / (years * 12));
    events.push({
      id: `silhouette:${index}`,
      occurredAt: `${day.toISOString().slice(0, 10)}T12:00:00+03:00`,
      source: 'memories-preview@1',
      evidence: 'verified',
      channels: { remembrance: 0.5, culture: 0.3, exploration: 0.4 },
      portalActivity: 0.3,
    });
  }
  const build = buildTreeLabPreviewFromArtifact({
    artifact: buildArtifactBlueprint({
      coupleId: 'amore:silhouette-spread',
      config: {
        engineVersion: 'tree-preview-1.0.0',
        relationshipStartedAt: start.toISOString().slice(0, 10),
        timeZone: 'Europe/Kyiv',
        leapDayPolicy: 'feb-28',
      },
      events,
    }),
    asOf: '2026-08-30T12:00:00+03:00',
    lod: 'medium',
    rulesVersion: 'tree-species-silhouette',
  });
  return buildTreeCrownSilhouette({
    composition: build.composition,
    leaves: build.leaves,
    canopyDepth: build.canopyDepth,
    canopyLight: build.canopyLight,
    phenology: build.phenology,
    leafOrientation: build.leafOrientation,
    config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
  });
}

describe('Tree Crown Silhouette', () => {
  it('publishes deterministic bounded front closure for the accepted crown', () => {
    const first = rebuild().silhouette;
    const second = rebuild().silhouette;

    expect(second).toEqual(first);
    expect(first.profiles).toHaveLength(first.diagnostics.sourceLeafCount);
    expect(first.diagnostics.adjustedOuterLeafCount).toBeGreaterThan(0);
    expect(first.diagnostics.adjustedMiddleLeafCount).toBeGreaterThan(0);
    expect(first.diagnostics.frontClosureLeafCount).toBeGreaterThan(0);

    /*
     * ЗАТЯГУВАННЯ ВСЕРЕДИНУ ПРАЦЮЄ — І ЦЕ СПРОСТУВАННЯ ТОГО, ЩО Я ТУТ ПИСАВ.
     *
     * У попередній редакції на цьому місці стояло `toBe(0)` з довгим
     * поясненням, що механізм недосяжний «майже за побудовою»:
     * `sourceRadialRatio` ділить ГОРИЗОНТАЛЬНУ відстань листка на ОБ'ЄМНИЙ
     * радіус композиції, і найбільше відношення серед 432 листків виходило
     * 0.519 при порозі 0.5 — тобто затягувався рівно один листок.
     *
     * Знаменник не змінився. Змінилось дерево: самоорганізаційна модель
     * (ADR-0072) дала крону, ширшу відносно висоти, а не вузький шар на
     * жердині. Виміряно на ній: найбільше відношення 0.698, вище за поріг
     * 112 листків із 503, затягується 19.
     *
     * Тобто той висновок був не про знаменник, а про ПРОПОРЦІЇ старого
     * дерева, — і я записав його як властивість коду. Правильне
     * формулювання: механізм працює лише на кроні, що справді відходить
     * убік, і на попередньому дереві такої не було.
     */
    /*
     * ЗАТЯГУВАННЯ ПЕРЕВІРЯЄТЬСЯ НА ДОРОСЛОМУ ДЕРЕВІ, а не на фікстурі.
     *
     * Коментар вище лишається чинним, але описує вже третій стан. Відколи
     * ширина крони — закон віку (ADR-0097), фікстура на два з половиною роки
     * знову вузька за побудовою (0.60 висоти), тож механізм на ній не
     * спрацьовує — і це правильно, а не вада. Тому перевірка переїхала на
     * двадцятирічне дерево, де крона справді відходить убік.
     */
    const spreading = spreadingCrown();
    expect(spreading.diagnostics.frontClosureInwardLeafCount).toBeGreaterThan(0);
    expect(Math.max(...spreading.profiles.map((profile) => profile.sourceRadialRatio)))
      .toBeGreaterThan(DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.frontClosureTargetRadialRatio);
    /*
     * Третій доданок з'явився разом зі стелею крони (ADR-0108): вона шарів
     * не знає, тож зсунутим буває й внутрішній листок. Тотожність лишається
     * тотожністю — саме тому доданок додано, а не поріг ослаблено.
     */
    expect(first.diagnostics.adjustedLeafCount).toBe(
      first.diagnostics.adjustedOuterLeafCount
        + first.diagnostics.adjustedMiddleLeafCount
        + first.diagnostics.adjustedInnerLeafCount,
    );
    expect(first.diagnostics.stableLeafOrderPreserved).toBe(true);
    expect(first.diagnostics.instanceCountPreserved).toBe(true);
    expect(first.diagnostics.crownCellProvenancePreserved).toBe(true);
    expect(first.diagnostics.preservedEmptySectorIndices).toBe(true);
    expect(first.diagnostics.filledPreviouslyEmptySectors).toBe(false);
    expect(first.diagnostics.preservedVerticalBands).toBe(true);
    expect(first.diagnostics.silhouetteErrorNotIncreased).toBe(true);
    expect(first.diagnostics.negativeSpaceAccepted).toBe(true);
    expect(first.diagnostics.averageEnvelopeErrorAfter).toBeLessThanOrEqual(
      first.diagnostics.averageEnvelopeErrorBefore + 1e-6,
    );
    expect(first.diagnostics.maximumRadialOffsetRatio).toBeLessThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumRadialOffsetRatio + 1e-6,
    );
    expect(first.diagnostics.maximumFrontClosureInwardOffsetRatio).toBeLessThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.frontClosureMaximumInwardOffsetRatio + 1e-6,
    );
    expect(first.diagnostics.maximumScaleDelta).toBeLessThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumScaleDelta + 1e-6,
    );
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame).toBe(0);

    const inwardProfiles = first.profiles.filter(
      (profile) => profile.frontClosureInwardOffsetRatio < 0,
    );
    expect(inwardProfiles.length).toBe(first.diagnostics.frontClosureInwardLeafCount);

    for (const profile of first.profiles) {
      expect(profile.sourceSectorIndex).toBe(profile.renderSectorIndex);
      expect(Math.abs(profile.scaleMultiplier - 1)).toBeLessThanOrEqual(
        DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumScaleDelta + 1e-6,
      );
      if (profile.layer === 'outer') {
        expect(profile.envelopeErrorAfter).toBeLessThanOrEqual(profile.envelopeErrorBefore + 1e-6);
        /*
         * Дозвіл `maximumRadialOffsetRatio` в'яже НУДЖЕННЯ до оболонки.
         * Стеля крони (ADR-0108) — інший рух: вона заводить листок під
         * оболонку на скільки треба, бо листка за кроною не буває.
         */
        if (!profile.ceilingClamped) {
          expect(Math.abs(profile.radialOffsetRatio)).toBeLessThanOrEqual(
            DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumRadialOffsetRatio + 1e-6,
          );
        }
      }
      if (profile.frontClosureSelected) {
        expect(profile.layer).toBe('middle');
        expect(profile.frontClosureInwardOffsetRatio).toBeLessThanOrEqual(0);
        expect(Math.abs(profile.frontClosureInwardOffsetRatio)).toBeLessThanOrEqual(
          DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.frontClosureMaximumInwardOffsetRatio + 1e-6,
        );
      }
      if (profile.layer === 'inner') {
        /*
         * Внутрішній листок не НУДЯТЬ до оболонки — його там не видно, і
         * рухати його означало б платити за невидиме. Але стеля крони
         * (ADR-0108) шарів не знає: листок за оболонкою це листок поза
         * кроною, хай яким глибоким його визнала глибина крони. Тому
         * недоторканність внутрішнього шару тепер стосується всього, крім
         * стелі, а РОЗМІР його картки не міняється й тоді.
         */
        expect(profile.scaleMultiplier).toBe(1);
        if (!profile.ceilingClamped) {
          expect(profile.adjusted).toBe(false);
          expect(profile.renderPosition).toEqual(profile.sourcePosition);
        }
        expect(profile.frontClosureSelected).toBe(false);
        expect(profile.frontClosureInwardOffsetRatio).toBe(0);
        expect(profile.frontClosureScaleDelta).toBe(0);
      }
    }
  });

  it('accepts crown readability from eight canonical viewing directions', () => {
    const { silhouette } = rebuild();

    expect(silhouette.diagnostics.viewReadability).toHaveLength(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.viewDirectionCount,
    );
    expect(silhouette.diagnostics.viewReadabilityAccepted).toBe(true);
    expect(silhouette.diagnostics.minimumReadableFrontLeafFraction).toBeGreaterThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.minimumReadableLeafFraction,
    );

    for (const view of silhouette.diagnostics.viewReadability) {
      expect(view.frontLeafCount).toBeGreaterThan(0);
      expect(view.readableFrontLeafCount).toBeGreaterThan(0);
      expect(view.readableFrontLeafFraction).toBeGreaterThanOrEqual(
        DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.minimumReadableLeafFraction,
      );
      expect(view.accepted).toBe(true);
      expect(Math.hypot(view.direction.x, view.direction.y, view.direction.z)).toBeCloseTo(1, 5);
    }
  });

  it('keeps accepted leaf transforms stable across LODs', () => {
    const low = rebuild('low').silhouette.profiles;
    const medium = rebuild('medium').silhouette.profiles;
    const high = rebuild('high').silhouette.profiles;
    const mediumByLeafId = new Map(medium.map((profile) => [profile.leafInstanceId, profile] as const));
    const highByLeafId = new Map(high.map((profile) => [profile.leafInstanceId, profile] as const));

    for (const profile of low) {
      expect(mediumByLeafId.get(profile.leafInstanceId)).toMatchObject({
        leafInstanceId: profile.leafInstanceId,
        layer: profile.layer,
        crownCellId: profile.crownCellId,
        renderPosition: profile.renderPosition,
        radialOffsetRatio: profile.radialOffsetRatio,
        frontClosureSelected: profile.frontClosureSelected,
        frontClosureInwardOffsetRatio: profile.frontClosureInwardOffsetRatio,
        frontClosureScaleDelta: profile.frontClosureScaleDelta,
        scaleMultiplier: profile.scaleMultiplier,
      });
      expect(highByLeafId.get(profile.leafInstanceId)).toMatchObject({
        leafInstanceId: profile.leafInstanceId,
        layer: profile.layer,
        crownCellId: profile.crownCellId,
        renderPosition: profile.renderPosition,
        radialOffsetRatio: profile.radialOffsetRatio,
        frontClosureSelected: profile.frontClosureSelected,
        frontClosureInwardOffsetRatio: profile.frontClosureInwardOffsetRatio,
        frontClosureScaleDelta: profile.frontClosureScaleDelta,
        scaleMultiplier: profile.scaleMultiplier,
      });
    }
  });

  it('preserves upstream state and rejects incompatible provenance', () => {
    const build = buildTreeLabPreview('medium');
    const before = JSON.stringify({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
    });

    buildTreeCrownSilhouette({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
      config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
    });

    expect(JSON.stringify({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
    })).toBe(before);

    expect(() => buildTreeCrownSilhouette({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: {
        ...build.leafOrientation,
        artifactSeed: build.leafOrientation.artifactSeed + 1,
      },
      config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
    })).toThrow(/different artifacts/);
  });
});