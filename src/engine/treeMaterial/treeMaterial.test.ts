import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_MATERIAL_CONFIG } from './config';
import { buildTreeMaterialState } from './treeMaterial';

function expectQuantized(value: number, steps: number) {
  expect(value).toBeGreaterThanOrEqual(0);
  expect(value).toBeLessThanOrEqual(1);
  expect(value * (steps - 1)).toBeCloseTo(Math.round(value * (steps - 1)), 4);
}

describe('Tree Material Lab', () => {
  it('pins the published rules version, so a bump is a decision', () => {
    // Версія правил — частина опублікованого стану: вона входить у ключ
    // матеріала й у контрольні точки. Досі її не тримав жоден тест, і коли
    // v1.0.0 стала v1.1.0 разом зі зміною кори, про це дізнався лише
    // браузерний набір — через шість днів і як «червона перевірка, яку всі
    // ігнорують». Тепер бамп ламає цей тест одразу й вимагає пояснення.
    expect(DEFAULT_TREE_MATERIAL_CONFIG.rulesVersion).toBe('tree-material-v1.1.0');
    const materials = buildTreeLabPreview('medium').materials;
    for (const material of materials.materials) {
      expect(material.signature.startsWith(`${DEFAULT_TREE_MATERIAL_CONFIG.rulesVersion}|`)).toBe(true);
    }
  });

  it('is deterministic and publishes exactly bark plus foliage', () => {
    const first = buildTreeLabPreview('medium').materials;
    const second = buildTreeLabPreview('medium').materials;

    expect(second).toEqual(first);
    expect(first.materials.map((material) => material.role)).toEqual(['bark', 'foliage']);
    expect(first.diagnostics.uniqueMaterialCount).toBe(2);
    expect(first.diagnostics.materialBudget).toBe(2);
    expect(first.diagnostics.materialBudgetExceeded).toBe(false);
    expect(first.diagnostics.duplicateRoleIds).toEqual([]);
    expect(first.bindings.branchMaterialId).toBe('tree:material:bark');
    expect(first.bindings.leafMaterialId).toBe('tree:material:foliage');
  });

  it('quantizes every published palette channel', () => {
    const state = buildTreeLabPreview('medium').materials;
    for (const color of [state.palette.bark, state.palette.foliage]) {
      expectQuantized(color.r, DEFAULT_TREE_MATERIAL_CONFIG.quantizationSteps);
      expectQuantized(color.g, DEFAULT_TREE_MATERIAL_CONFIG.quantizationSteps);
      expectQuantized(color.b, DEFAULT_TREE_MATERIAL_CONFIG.quantizationSteps);
    }
  });

  it('keeps material identity independent from geometry LOD', () => {
    const high = buildTreeLabPreview('high').materials;
    const medium = buildTreeLabPreview('medium').materials;
    const low = buildTreeLabPreview('low').materials;

    expect(medium).toEqual(high);
    expect(low).toEqual(high);
  });

  it('does not mutate accepted upstream states', () => {
    const build = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(build.species);
    const compositionBefore = JSON.stringify(build.composition);
    const foliageBefore = JSON.stringify(build.foliage);
    const leavesBefore = JSON.stringify(build.leaves);

    buildTreeMaterialState({
      species: build.species,
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      config: DEFAULT_TREE_MATERIAL_CONFIG,
    });

    expect(JSON.stringify(build.species)).toBe(speciesBefore);
    expect(JSON.stringify(build.composition)).toBe(compositionBefore);
    expect(JSON.stringify(build.foliage)).toBe(foliageBefore);
    expect(JSON.stringify(build.leaves)).toBe(leavesBefore);
  });

  it('rejects any material budget other than two', () => {
    const build = buildTreeLabPreview('medium');
    expect(() => buildTreeMaterialState({
      species: build.species,
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      config: {
        ...DEFAULT_TREE_MATERIAL_CONFIG,
        maxMaterials: 3 as 2,
      },
    })).toThrow('exactly two');
  });
});
