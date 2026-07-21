// ============================================================
// Тести Species Layer (Volume II): SDK виду. Кристал реалізує інтерфейс
// Species (react/evolve/constrain/buildInstructions); Growth Instructions
// містять усе, що потрібно Growth Engine, і НІЧОГО про Three.js/матеріали.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeEvolutionPressures, crystalSpecies, generateArtifactDNA, type ArtifactInput } from '../index';
import { hashSeedString } from '../../mulberry32';

const SEED = '8264-3607-EEA8';
const NOW = new Date('2026-07-21T12:00:00');

function isoDaysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeInput(overrides: Partial<ArtifactInput> = {}): ArtifactInput {
  const memories = [480, 410, 350, 290, 220, 160, 45].map((age, i) => ({ id: i + 1, date: isoDaysAgo(age) }));
  return {
    seedNum: hashSeedString(SEED),
    dna: generateArtifactDNA(SEED),
    usage: {
      daysTogether: 500,
      photos: 40,
      places: 4,
      moviesWatched: 12,
      booksRead: 2,
      wishesDone: 2,
      goalsAchieved: 1,
      anniversaries: 1,
      recipesSaved: 3,
      distinctCountries: 2,
      milestones: 2,
      totalSaved: 1200,
    },
    countries: [
      { name: 'Italy', firstVisit: isoDaysAgo(400) },
      { name: 'Spain', firstVisit: isoDaysAgo(200) },
    ],
    cities: [
      { name: 'Kyiv', firstVisit: isoDaysAgo(450) },
      { name: 'Rome', firstVisit: isoDaysAgo(398) },
    ],
    milestones: [
      { id: 1, title: 'Заручини', date: isoDaysAgo(300) },
      { id: 2, title: 'Річниця знайомства', date: isoDaysAgo(100) },
    ],
    wishes: [
      { id: 3, fulfilledAt: isoDaysAgo(80) },
      { id: 7, fulfilledAt: isoDaysAgo(20) },
    ],
    achievedGoals: [{ id: 1, date: isoDaysAgo(150) }],
    anniversaries: [{ id: 2, date: isoDaysAgo(135) }],
    recipes: [
      { id: 1, date: isoDaysAgo(90) },
      { id: 2, date: isoDaysAgo(60) },
      { id: 3, date: isoDaysAgo(30) },
    ],
    movies: [
      { id: 1, date: isoDaysAgo(70) },
      { id: 2, date: isoDaysAgo(50) },
    ],
    books: [],
    memoriesCount: memories.length,
    memories,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Species Layer — CrystalSpecies', () => {
  it('реалізує SDK-інтерфейс виду', () => {
    expect(crystalSpecies.name).toBe('crystal');
    expect(typeof crystalSpecies.react).toBe('function');
    expect(typeof crystalSpecies.evolve).toBe('function');
    expect(typeof crystalSpecies.constrain).toBe('function');
    expect(typeof crystalSpecies.buildInstructions).toBe('function');
  });

  it('морфологія описує, що взагалі може рости в кристала (§9)', () => {
    expect(crystalSpecies.morphology).toContain('druse');
    expect(crystalSpecies.morphology).toContain('cracks');
    expect(crystalSpecies.morphology).toContain('inclusions');
  });

  it('react() = species-проєкція тисків, тотожна публічному computeEvolutionPressures', () => {
    const input = makeInput();
    expect(crystalSpecies.react(input)).toEqual(computeEvolutionPressures(input));
  });

  it('evolve() — стадії життєвого циклу виду (§12)', () => {
    expect(crystalSpecies.evolve(0.05, 1, 0)).toBe('nucleation');
    expect(crystalSpecies.evolve(0.4, 1, 0)).toBe('growth');
    expect(crystalSpecies.evolve(0.7, 0.4, 0)).toBe('competition');
    expect(crystalSpecies.evolve(0.95, 1, 0)).toBe('stabilization');
    expect(crystalSpecies.evolve(0.8, 1, 0.8)).toBe('polishing');
  });

  it('constrain() кодує природні правила виду числами (§10)', () => {
    const c = crystalSpecies.constrain();
    // Кристал не росте вниз: напрямок завжди має додатну вертикаль.
    expect(c.minUpwardMain).toBeGreaterThan(0);
    expect(c.minUpwardRare).toBeGreaterThan(0);
    // Основи вростають (поховані), нуклеація — біля основи субстрату.
    expect(c.burial).toBeGreaterThan(0);
    expect(c.siteTMin).toBeLessThan(c.siteTMax);
    // Морфологія друзи: колонії дозволені.
    expect(c.coloniesEnabled).toBe(true);
  });

  it('buildInstructions() повертає Growth Instructions без знання про рендер (§5,§7)', () => {
    const inst = crystalSpecies.buildInstructions(makeInput());
    expect(Array.isArray(inst.streams)).toBe(true);
    expect(inst.streams.length).toBeGreaterThan(0);
    expect(typeof inst.fieldAt).toBe('function');
    expect(inst.hierarchy.monarchKey).toBe('core-0'); // головний кристал друзи
    expect(inst.constraints.burial).toBeGreaterThan(0);
    // Ніякого THREE/матеріалів — суто дані. Серіалізується як JSON без функцій-мешів.
    const json = JSON.stringify({
      streams: inst.streams.length,
      monarchKey: inst.hierarchy.monarchKey,
      state: inst.speciesState,
    });
    expect(json).not.toContain('three');
  });

  it('speciesState — внутрішній стан виду в [0,1] (§13)', () => {
    const s = crystalSpecies.buildInstructions(makeInput()).speciesState;
    for (const [name, value] of Object.entries(s)) {
      expect(value, `стан ${name}`).toBeGreaterThanOrEqual(0);
      expect(value, `стан ${name}`).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(s).sort()).toEqual(['density', 'energy', 'fracture', 'purity', 'stress']);
  });

  it('fieldAt детерміноване і не бачить майбутнього (гейтинг за віком)', () => {
    const inst = crystalSpecies.buildInstructions(makeInput());
    const a = inst.fieldAt(250);
    const b = inst.fieldAt(250);
    expect(a).toEqual(b);
    // На вік 250 подорожей менше, ніж сьогодні → менший expansion.
    expect(inst.fieldAt(250).expansion).toBeLessThanOrEqual(inst.fieldAt(0).expansion);
  });
});
