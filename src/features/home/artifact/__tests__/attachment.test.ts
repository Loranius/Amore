// ============================================================
// Тести контракту кріплення (Volume IV / `CAI-REQ-004`, `V4-REQ-013..015`).
// Нормативно: docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md §3,§5.
//
// Фіксують те, чого раніше не існувало взагалі: Growth Engine обирав
// господаря й одразу викидав його ідентичність, тож Geometry Engine не мав
// як обробити стик. Тепер кожне фізичне кріплення — версійований запис.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATTACHMENT_JUNCTION_VERSION,
  buildJunctions,
  findOrphans,
  generateArtifactDNA,
  runGrowth,
  type ArtifactInput,
  type JunctionBody,
} from '../index';
import { hashSeedString } from '../../mulberry32';
import { dot, lengthOf, v3 } from '../vec3';

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
      daysTogether: 1303,
      photos: 50,
      places: 25,
      moviesWatched: 112,
      booksRead: 0,
      wishesDone: 3,
      goalsAchieved: 1,
      anniversaries: 4,
      recipesSaved: 6,
      distinctCountries: 8,
      milestones: 3,
      totalSaved: 42000,
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

describe('AttachmentJunction — CAI-REQ-004', () => {
  it('кожне НЕкореневе тіло має рівно один junction, сиріт немає', () => {
    const state = runGrowth(makeInput());
    expect(state.bodies.length).toBeGreaterThan(10);

    const asJunctionBodies: JunctionBody[] = state.bodies.map((b) => ({
      key: b.key,
      anchor: b.renderedAnchor,
      direction: b.direction,
      length: b.length,
      radius: b.radius,
      hostKey: b.attachment?.hostKey ?? null,
    }));
    expect(findOrphans(asJunctionBodies)).toEqual([]);

    const attached = state.bodies.filter((b) => b.attachment?.hostKey != null);
    expect(attached.length).toBeGreaterThan(0);
    expect(state.junctions).toHaveLength(attached.length);

    // Рівно один host на дитину (профіль §5: без bridge/intergrowth).
    const perChild = new Map<string, number>();
    for (const j of state.junctions) perChild.set(j.childComponentId, (perChild.get(j.childComponentId) ?? 0) + 1);
    for (const [child, n] of perChild) expect(n, `у ${child} кілька господарів`).toBe(1);
  });

  it('кореневі тіла (на віртуальному нуклеусі) junction не мають', () => {
    const state = runGrowth(makeInput());
    const roots = state.bodies.filter((b) => (b.attachment?.hostKey ?? null) === null);
    expect(roots.length).toBeGreaterThan(0);
    const childIds = new Set(state.junctions.map((j) => j.childComponentId));
    for (const r of roots) expect(childIds.has(r.key), `корінь ${r.key} отримав junction`).toBe(false);
    // Віртуальний нуклеус ніколи не публікується як тіло.
    expect(state.bodies.some((b) => b.key === '__nucleus')).toBe(false);
  });

  it('junction описує геометрію стику коректно й версійовано', () => {
    const state = runGrowth(makeInput());
    for (const j of state.junctions) {
      expect(j.version).toBe(ATTACHMENT_JUNCTION_VERSION);
      expect(j.hostComponentId).not.toBe(j.childComponentId);
      expect(j.contactRadius).toBeGreaterThan(0);
      // Кліренс ширший за пляму контакту — це зона, вільна від чужих тіл.
      expect(j.clearanceRadius).toBeGreaterThan(j.contactRadius);
      expect(j.penetrationDepth).toBeGreaterThanOrEqual(0);
      expect(j.materialBlendWidth).toBeGreaterThan(0);
      expect(j.allowedIntersectionBounds.radius).toBeGreaterThan(0);
      expect(j.trimPolicy).toBe('analytic-clip');
      // Локальна рамка ортонормована — Geometry Engine будує в ній кліп.
      const { normal, tangent, bitangent } = j.localFrame;
      expect(lengthOf(normal)).toBeCloseTo(1, 6);
      expect(lengthOf(tangent)).toBeCloseTo(1, 6);
      expect(lengthOf(bitangent)).toBeCloseTo(1, 6);
      expect(dot(normal, tangent)).toBeCloseTo(0, 6);
      expect(dot(normal, bitangent)).toBeCloseTo(0, 6);
      for (const c of [normal.x, normal.y, normal.z, j.contactRadius, j.penetrationDepth]) {
        expect(Number.isFinite(c)).toBe(true);
      }
    }
  });

  it('детермінізм: той самий вхід → байт-в-байт ті самі junction-и', () => {
    expect(runGrowth(makeInput()).junctions).toEqual(runGrowth(makeInput()).junctions);
  });

  it('порядок junction-ів канонічний (за junctionId)', () => {
    const ids = runGrowth(makeInput()).junctions.map((j) => j.junctionId);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('buildJunctions: осиротіле тіло не отримує junction і потрапляє у звіт', () => {
    const bodies: JunctionBody[] = [
      { key: 'host', anchor: v3(0, 0, 0), direction: v3(0, 1, 0), length: 1, radius: 0.2, hostKey: null },
      { key: 'child', anchor: v3(0.1, 0.3, 0), direction: v3(0.3, 1, 0), length: 0.5, radius: 0.08, hostKey: 'host' },
      { key: 'lost', anchor: v3(1, 1, 1), direction: v3(0, 1, 0), length: 0.3, radius: 0.05, hostKey: 'gone' },
    ];
    const junctions = buildJunctions(bodies);
    expect(junctions).toHaveLength(1);
    expect(junctions[0]!.junctionId).toBe('host->child');
    expect(findOrphans(bodies)).toEqual(['lost']);
  });
});
