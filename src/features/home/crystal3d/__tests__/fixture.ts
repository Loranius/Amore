// ============================================================
// Фікстура геометричних і матеріальних тестів: реальна маса з рушія.
// ------------------------------------------------------------
// Навмисно НЕ синтетичні «два циліндри»: перевіряти обробку стику треба на
// тій самій композиції, що йде на екран пари, — інакше тест зелений на
// іграшці й сліпий до справжнього кристала.
//
// Конвеєр не дублюється: `buildMass` викликає той самий `publishCrystal`,
// що й сцена. Якби фікстура складала кроки самотужки, тести перевіряли б
// свою власну послідовність, а не ту, що йде користувачеві.
// ============================================================
import {
  buildArtifactNodes,
  computeEvolutionPressures,
  generateArtifactDNA,
  type ArtifactInput,
} from '../../artifact';
import { hashSeedString } from '../../mulberry32';
import { deriveClusterBranch, deriveClusterMaterial, type ClusterBranch, type ClusterMaterial } from '../crystalCluster';
import { publishCrystal, type PublishedBody, type PublishedCrystal, type PublishOptions } from '../crystalPublication';
import type { HostSolid } from '../geometry/hostBody';
import type { TrimStats } from '../geometry/junctionTrim';
import type { MaterialEntry } from '../material/validateMaterial';
import type { ShellEntry } from '../geometry/validateShell';
import type * as THREE from 'three';

/** Записані детерміновані сіди (правило `.claude/rules/tests.md`). */
export const SEEDS = ['8264-3607-EEA8', '1A2B-3C4D-5E6F', 'DEAD-BEEF-0001', '0000-1111-2222'] as const;

const NOW = new Date('2026-07-21T12:00:00');

function isoDaysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function makeInput(seed: string): ArtifactInput {
  const memories = [480, 410, 350, 290, 220, 160, 45].map((age, i) => ({ id: i + 1, date: isoDaysAgo(age) }));
  return {
    seedNum: hashSeedString(seed),
    dna: generateArtifactDNA(seed),
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
    ...(seed === SEEDS[3] ? { books: [{ id: 1, date: isoDaysAgo(210) }] } : {}),
  };
}

export interface BuiltBody {
  branch: ClusterBranch;
  solid: HostSolid;
  geometry: THREE.BufferGeometry;
  stats: TrimStats;
}

export interface BuiltMass {
  material: ClusterMaterial;
  solids: Map<string, HostSolid>;
  bodies: BuiltBody[];
  published: PublishedCrystal;
}

export function buildBranches(seed: string): { branches: ClusterBranch[]; material: ClusterMaterial } {
  const input = makeInput(seed);
  const pressures = computeEvolutionPressures(input);
  return {
    branches: buildArtifactNodes(input, pressures).map((n) => deriveClusterBranch(n, input.dna)),
    material: deriveClusterMaterial(pressures),
  };
}

const toBuiltBody = (b: PublishedBody): BuiltBody => ({
  branch: b.branch,
  solid: b.solid,
  geometry: b.geometry,
  stats: b.trim,
});

/** Повна маса — рівно тим конвеєром, що й у сцені. */
export function buildMass(seed: string, options: PublishOptions = {}): BuiltMass {
  const { branches, material } = buildBranches(seed);
  const published = publishCrystal(branches, material, options);
  return {
    material,
    solids: new Map(published.bodies.map((b) => [b.branch.key, b.solid])),
    bodies: published.bodies.map(toBuiltBody),
    published,
  };
}

export const toShellEntries = (mass: BuiltMass): ShellEntry[] =>
  mass.bodies.map(({ solid, branch, geometry }) => ({ solid, hostKey: branch.hostKey, geometry }));

export const toMaterialEntries = (mass: BuiltMass): MaterialEntry[] =>
  mass.bodies.map(({ branch, solid, geometry }) => ({ branch, solid, geometry }));
