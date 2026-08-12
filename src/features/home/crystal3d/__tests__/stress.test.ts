// ============================================================
// Матриця валідації §8 профілю + Testing Strategy.
// ------------------------------------------------------------
// Покриває рядки, яких досі не було:
//   360° оберт · вид згори · похилі згори · близькі види стиків ·
//   максимальна кількість дітей · тонкий господар із товстою дитиною ·
//   двоє сусідів на мінімальній відстані · зрілий господар зі свіжими
//   дітьми · топологія (вироджені/дубльовані/копланарні грані, межа
//   оболонки) — і все це на КОЖНОМУ публікованому LOD.
//
// Профіль: «Raster screenshots alone are not sufficient» — тому все тут
// геометричне: буфери й промені, жодного порівняння картинок.
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildBranches, SEEDS } from './fixture';
import { STRESS_CASES, STRESS_MATERIAL } from './stress';
import { formatPublicationReport, publishCrystal } from '../crystalPublication';
import { LOD_LEVELS } from '../geometry/lod';
import {
  formatShellViolations,
  probeExterior,
  probeJunctions,
  VALIDATION_VIEWS,
} from '../geometry/validateShell';
import { formatTopologyViolations, validateTopology } from '../geometry/validateTopology';

const shellEntries = (p: ReturnType<typeof publishCrystal>) =>
  p.bodies.map((b) => ({ solid: b.solid, hostKey: b.branch.hostKey, geometry: b.geometry }));

// This is a correctness stress matrix, not a performance benchmark. The
// max-children case probes every published LOD from many exterior and close-up
// junction views and can legitimately cross Vitest's 5s default on a loaded
// GitHub runner. Keep the larger budget local to this one heavy assertion.
const STRESS_SHELL_TIMEOUT_MS = 15_000;

describe('§8 матриця видів — реальна маса', () => {
  it('повний оберт + верх + похилі + низ: жодного вивороту оболонки', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      for (const lod of LOD_LEVELS) {
        const p = publishCrystal(branches, material, { lod });
        const violations = probeExterior(shellEntries(p), VALIDATION_VIEWS);
        expect(formatShellViolations(violations), `${seed} @ ${lod}`).toBe('external shell: 0 порушень');
      }
    }
  });

  it('близькі види КОЖНОГО стику (не лише глобальна сітка)', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      for (const lod of LOD_LEVELS) {
        const p = publishCrystal(branches, material, { lod });
        expect(formatShellViolations(probeJunctions(shellEntries(p))), `${seed} @ ${lod}`).toBe(
          'external shell: 0 порушень',
        );
      }
    }
  });
});

describe('§8 стрес-конфігурації', () => {
  for (const testCase of STRESS_CASES) {
    describe(`${testCase.id} (${testCase.requirement})`, () => {
      it('гейт публікації проходить на всіх LOD', () => {
        for (const lod of LOD_LEVELS) {
          const p = publishCrystal(testCase.branches, STRESS_MATERIAL, { lod });
          expect(formatPublicationReport(p), `${testCase.id} @ ${lod}`).toContain(
            'гейт публікації: пройдено',
          );
        }
      });

      it('матриця видів і близькі стики чисті', () => {
        for (const lod of LOD_LEVELS) {
          const p = publishCrystal(testCase.branches, STRESS_MATERIAL, { lod });
          const entries = shellEntries(p);
          expect(formatShellViolations(probeExterior(entries, VALIDATION_VIEWS)), `${testCase.id} @ ${lod}`).toBe(
            'external shell: 0 порушень',
          );
          expect(formatShellViolations(probeJunctions(entries)), `${testCase.id} @ ${lod}`).toBe(
            'external shell: 0 порушень',
          );
        }
      }, STRESS_SHELL_TIMEOUT_MS);
    });
  }
});

describe('топологія — Testing Strategy «Geometry Integrity»', () => {
  it('реальна маса: без вироджених, дубльованих і копланарних граней', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      for (const lod of LOD_LEVELS) {
        const p = publishCrystal(branches, material, { lod });
        expect(formatTopologyViolations(p.topologyViolations), `${seed} @ ${lod}`).toBe('topology: 0 порушень');
      }
    }
  });

  it('перевірка вміє впасти: дубльована грань ловиться', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const p = publishCrystal(branches, material);
    const victim = p.bodies.find((b) => (b.geometry.getIndex()?.count ?? 0) >= 3)!;
    const index = victim.geometry.getIndex()!;
    const dup = [...Array.from(index.array), index.getX(0), index.getX(1), index.getX(2)];
    victim.geometry.setIndex(dup);
    const violations = validateTopology(shellEntries(p));
    expect(violations.some((v) => v.kind === 'duplicate-face' && v.key === victim.branch.key)).toBe(true);
  });

  it('перевірка вміє впасти: вироджена грань ловиться', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const p = publishCrystal(branches, material);
    const victim = p.bodies.find((b) => (b.geometry.getIndex()?.count ?? 0) >= 3)!;
    const index = victim.geometry.getIndex()!;
    const a = index.getX(0);
    // Трикутник із трьох однакових вершин має нульову площу.
    victim.geometry.setIndex([...Array.from(index.array), a, a, a]);
    const violations = validateTopology(shellEntries(p));
    expect(violations.some((v) => v.kind === 'degenerate-face' && v.key === victim.branch.key)).toBe(true);
  });

  it('перевірка вміє впасти: відкрита межа назовні ловиться', () => {
    // У спільній матриці верхня кришка значною мірою закрита короною, тому
    // видалення останніх індексів більше не гарантує зовнішню діру. Вирізаємо
    // чотири трикутники з середини lathe-буфера — це бічна стінка породи,
    // яка за визначенням дивиться назовні й мусить дати open boundary.
    const { branches, material } = buildBranches(SEEDS[0]);
    const p = publishCrystal(branches, material);
    const victim = p.bodies.find(
      (b) => b.branch.hostKey === null && (b.geometry.getIndex()?.count ?? 0) > 30,
    )!;
    const index = victim.geometry.getIndex()!;
    const all = Array.from(index.array);
    const cutStart = Math.floor((index.count * 0.45) / 3) * 3;
    const kept = [...all.slice(0, cutStart), ...all.slice(cutStart + 12)];
    victim.geometry.setIndex(kept);
    const violations = validateTopology(shellEntries(p));
    expect(violations.some((v) => v.kind === 'open-boundary-outside' && v.key === victim.branch.key)).toBe(
      true,
    );
  });
});
