import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { clamp01, round6 } from './index';
import * as growth from '../growth/math';
import * as material from '../material/color';
import * as speciesMath from '../species/shared/math';

// ============================================================
// Одне ядро чисел — і ті самі числа, що давали копії (ADR-0257).
// ------------------------------------------------------------
// Інваріант детермінізму (`docs/01_CONTRACTS/DETERMINISM_STANDARD.md`):
// ті самі входи дають ті самі виходи. Зведення копій мусить не змінити
// жодного біта, тож кожна стара форма відтворена тут і звірена з ядром
// через `Object.is` — він розрізняє −0 і +0, а NaN рахує рівним NaN.
// ============================================================

const INPUTS = [-0, 0, 0.5, 1, -3, 7, NaN, Infinity, -Infinity, Number.MIN_VALUE, -Number.MIN_VALUE, 0.1234565, 2.5e-7, -2.5e-7];

/** Форми, якими копії писали `clamp01` до зведення. */
const OLD_CLAMP01 = {
  speciesAndLabs: (v: number) => Math.max(0, Math.min(1, v)),
  materialAndLife: (v: number) => Math.min(1, Math.max(0, v)),
  growth: (v: number) => Math.min(1, Math.max(0, v)),
};

/** Форми `round6`: `1_000_000` і `1e6` — те саме число. */
const OLD_ROUND6 = (v: number) => Math.round(v * 1e6) / 1e6;

describe('deterministic kernel numerics', () => {
  it('clamp01 equals every merged copy on every input, including −0 and NaN', () => {
    for (const [name, old] of Object.entries(OLD_CLAMP01)) {
      for (const input of INPUTS) expect(Object.is(clamp01(input), old(input)), `${name}(${input})`).toBe(true);
    }
  });

  it('round6 equals the merged copies bit for bit', () => {
    for (const input of INPUTS) expect(Object.is(round6(input), OLD_ROUND6(input)), String(input)).toBe(true);
  });

  it('volumes hand out the kernel functions, not copies of them', () => {
    expect(growth.clamp01).toBe(clamp01);
    expect(growth.round6).toBe(round6);
    expect(material.clamp01).toBe(clamp01);
    expect(material.round6).toBe(round6);
    expect(speciesMath.clamp01).toBe(clamp01);
    expect(speciesMath.round6).toBe(round6);
  });

  it('depends on nothing — the kernel is the bottom of the dependency graph', () => {
    const source = readFileSync(fileURLToPath(new URL('./numeric.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
