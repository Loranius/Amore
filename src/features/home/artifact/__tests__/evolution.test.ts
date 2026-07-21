// ============================================================
// Тести Evolution Engine (Volume I): універсальна історія, Historical
// State («ніколи не бачить майбутнього»), нормалізовані сили, і
// ХАРАКТЕРИЗАЦІЯ species-проєкції — значення тисків зафіксовані ДО
// рефакторингу на Evolution Engine: та сама історія мусить давати
// байт-в-байт ті самі тиски (жодних візуальних змін від зміни архітектури).
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEvolutionTimeline,
  computeEvolutionPressures,
  generateArtifactDNA,
  historyAt,
  solveForces,
  type ArtifactInput,
} from '../index';
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

describe('Evolution Engine', () => {
  it('таймлайн детермінований і відсортований минуле → сьогодні', () => {
    const a = buildEvolutionTimeline(makeInput());
    const b = buildEvolutionTimeline(makeInput());
    expect(a).toEqual(b);
    for (let i = 1; i < a.events.length; i++) {
      expect(a.events[i - 1]!.ageDays).toBeGreaterThanOrEqual(a.events[i]!.ageDays);
    }
  });

  it('кожен модуль застосунку стає подіями історії; id стабільні', () => {
    const { events } = buildEvolutionTimeline(makeInput());
    const bySource = new Map<string, number>();
    for (const e of events) bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1);
    for (const source of ['travel', 'memories', 'goals', 'wishes', 'movies', 'recipes', 'milestones', 'anniversaries', 'photos', 'finances', 'time']) {
      expect(bySource.get(source), `джерело ${source} без подій`).toBeGreaterThan(0);
    }
    expect(events.map((e) => e.id)).toContain('travel:country:Italy');
    expect(events.map((e) => e.id)).toContain('milestones:2');
    expect(events.map((e) => e.id)).toContain('time:days-together');
  });

  it('historical growth: нові дані лише додають шар, стару історію не рухають', () => {
    const base = buildEvolutionTimeline(makeInput());
    const grown = buildEvolutionTimeline(
      makeInput({ wishes: [...makeInput().wishes, { id: 99, fulfilledAt: isoDaysAgo(0) }] }),
    );
    const grownById = new Map(grown.events.map((e) => [e.id, e]));
    for (const e of base.events) {
      expect(grownById.get(e.id), `подія ${e.id} зникла/змінилась`).toEqual(e);
    }
    expect(grownById.has('wishes:99')).toBe(true);
  });

  it('артефакт ніколи не бачить майбутнього: historyAt рахує лише не молодші події', () => {
    const timeline = buildEvolutionTimeline(makeInput());
    const at250 = historyAt(timeline, 250);
    // На вік 250 днів існували: Italy(400), Kyiv(450), Rome(398), заручини(300),
    // 4 спогади (480..290) — а Spain(200), цілі(150) тощо ще в майбутньому.
    expect(at250.countries).toBe(1);
    expect(at250.cities).toBe(2);
    expect(at250.milestones).toBe(1);
    expect(at250.memories).toBe(4);
    expect(at250.goals).toBe(0);
    expect(at250.wishes).toBe(0);
    expect(at250.daysTogetherThen).toBe(250);
    // Сьогодні (вік 0) видно все.
    const now = historyAt(timeline, 0);
    expect(now.countries).toBe(2);
    expect(now.wishes).toBe(2);
    expect(now.photos).toBe(40);
    expect(now.totalSaved).toBe(1200);
  });

  it('Pressure Solver: 10 канонічних сил, усі нормалізовані в [0,1]', () => {
    const forces = solveForces(buildEvolutionTimeline(makeInput()));
    const entries = Object.entries(forces);
    expect(entries).toHaveLength(10);
    for (const [name, value] of entries) {
      expect(value, `сила ${name}`).toBeGreaterThanOrEqual(0);
      expect(value, `сила ${name}`).toBeLessThanOrEqual(1);
    }
    expect(forces.growth).toBeCloseTo(0.5, 10); // 500/1000 днів разом
    expect(forces.expansion).toBeGreaterThan(0);
  });

  it('ХАРАКТЕРИЗАЦІЯ: species-проєкція тисків байт-в-байт як до рефакторингу', () => {
    // Значення зняті з computeEvolutionPressures ДО переходу на Evolution
    // Engine — зміна архітектури не сміє змінити жодного тиску.
    const p = computeEvolutionPressures(makeInput());
    expect(p.expansion).toBe(0.2857142857142857);
    expect(p.refinement).toBe(0.3333333333333333);
    expect(p.luminosity).toBe(0.24500000000000002);
    expect(p.warmth).toBe(0.15000000000000002);
    expect(p.stability).toBe(0.23750000000000002);
    expect(p.harmony).toBe(0.9038609667715);
    expect(p.movieMix).toBe(0.02);
    expect(p.surfaceComplexity).toBe(0);
    expect(p.density).toBe(1.1385794353331309);
    expect(p.dominant).toBe('connection');
    expect(p.dominance).toBe(0.3888888888888889);
    expect(p.domainShare).toEqual({
      exploration: 0.2222222222222222,
      memory: 0.19444444444444445,
      connection: 0.3888888888888889,
      creation: 0.1388888888888889,
      future: 0.05555555555555555,
    });
  });
});
