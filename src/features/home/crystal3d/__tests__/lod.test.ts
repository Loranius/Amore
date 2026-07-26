// ============================================================
// Тести рівнів деталізації та гейта публікації.
// ------------------------------------------------------------
// Перевіряють:
//   `CAI-REQ-011` — усі правила цілісності кріплення тримаються на КОЖНОМУ
//                   публікованому рівні, а не лише на найдетальнішому;
//   `CAI-REQ-012` — провал валідації видно як `ok: false` (гейт);
//   `V5-REQ-009`  — генерація LOD детермінована;
//   `V5-REQ-016`  — власність семантичних регіонів валідна на кожному рівні;
//   `V6-REQ-015`  — те саме для меж матеріального переходу.
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildBranches, SEEDS } from './fixture';
import { formatPublicationReport, publishAllLods, publishCrystal } from '../crystalPublication';
import { LOD_LEVELS, lodSegments } from '../geometry/lod';
import { computeCrystalProfile } from '../geometry/latheProfile';
import type { MaterialRegionStats } from '../material/crystalMaterial';

describe('LOD — `CAI-REQ-011` цілісність на кожному рівні', () => {
  it('гейт публікації проходить на всіх рівнях і всіх сідах', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      for (const published of publishAllLods(branches, material, { probe: true })) {
        expect(formatPublicationReport(published), `${seed} @ ${published.lod}`).toContain(
          'гейт публікації: пройдено',
        );
        expect(published.ok).toBe(true);
      }
    }
  });

  it('набір тіл і кріплень НЕ залежить від рівня — інакше з’являлись би сироти', () => {
    // Свідоме рішення LOD: скорочуємо грані, не тіла. Якби дрібний рівень
    // викидав тіла, дитина зниклого господаря стала б сиротою
    // (`CAI-REQ-004`) — рівно той баг, що ловився в Phase 2.
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const [high, ...rest] = publishAllLods(branches, material);
      const signature = (p: typeof high): string[] =>
        p!.bodies.map((b) => `${b.branch.key}<-${b.branch.hostKey ?? '—'}`);
      for (const other of rest) {
        expect(signature(other), `${seed} @ ${other.lod}`).toEqual(signature(high!));
      }
    }
  });

  it('дрібніший рівень справді дешевший — інакше LOD не має сенсу', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const counts = publishAllLods(branches, material).map((p) => ({
      lod: p.lod,
      tri: p.bodies.reduce((s, b) => s + (b.geometry.getIndex()?.count ?? 0) / 3, 0),
    }));
    const high = counts.find((c) => c.lod === 'high')!.tri;
    const medium = counts.find((c) => c.lod === 'medium')!.tri;
    const low = counts.find((c) => c.lod === 'low')!.tri;
    expect(medium).toBeLessThan(high);
    expect(low).toBeLessThan(medium);
  });

  it('`V6-REQ-015`: смуга шва лишається оголошеною і на дрібних рівнях', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      for (const published of publishAllLods(branches, material)) {
        for (const body of published.bodies) {
          const stats = body.geometry.userData.materialStats as MaterialRegionStats;
          if (body.branch.hostKey === null) {
            expect(stats.blendWidth, `${body.branch.key} @ ${published.lod}`).toBe(0);
          } else {
            expect(stats.blendWidth, `${body.branch.key} @ ${published.lod}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe('LOD — `V5-REQ-009` детермінізм', () => {
  it('той самий рівень двічі → побайтово та сама геометрія й кольори', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    for (const lod of LOD_LEVELS) {
      const a = publishCrystal(branches, material, { lod });
      const b = publishCrystal(branches, material, { lod });
      for (let i = 0; i < a.bodies.length; i++) {
        const x = a.bodies[i]!.geometry;
        const y = b.bodies[i]!.geometry;
        expect(Array.from(y.getIndex()!.array), `${lod}`).toEqual(Array.from(x.getIndex()!.array));
        expect(Array.from(y.getAttribute('color').array as Float32Array)).toEqual(
          Array.from(x.getAttribute('color').array as Float32Array),
        );
      }
    }
  });

  it('LOD змінює РОЗДІЛЬНІСТЬ, а не форму: потік випадковості не зсунувся', () => {
    // Множник граней застосовується після всіх звертань до shapeRng, тож
    // профіль (висота, пропорції, точки зламу) мусить збігатися дослівно.
    const { branches, material } = buildBranches(SEEDS[0]);
    for (const branch of branches) {
      const high = computeCrystalProfile(branch, material, 'high');
      for (const lod of LOD_LEVELS) {
        const p = computeCrystalProfile(branch, material, lod);
        expect(p.h, `${branch.key} @ ${lod}`).toBe(high.h);
        expect(p.r, `${branch.key} @ ${lod}`).toBe(high.r);
        expect(p.jitterAmp).toBe(high.jitterAmp);
        expect(p.side.map((s) => [s.r, s.y])).toEqual(high.side.map((s) => [s.r, s.y]));
        expect(p.segments).toBe(lodSegments(high.segments, lod));
      }
    }
  });

});

describe('draw calls — порожні тіла не публікуються як мешi', () => {
  it('renderable містить лише тіла з трикутниками, bodies — усі', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const p = publishCrystal(branches, material);
      for (const b of p.renderable) {
        expect((b.geometry.getIndex()?.count ?? 0), `${seed}/${b.branch.key}`).toBeGreaterThan(0);
      }
      // Стан зберігає ВСІ тіла: на прихованих тримаються кріплення дітей,
      // і викидання їх зі стану зробило б ті кріплення сиротами.
      expect(p.bodies.length).toBeGreaterThanOrEqual(p.renderable.length);
      const keys = new Set(p.bodies.map((b) => b.branch.key));
      for (const b of p.bodies) {
        if (b.branch.hostKey !== null) expect(keys.has(b.branch.hostKey), b.branch.key).toBe(true);
      }
    }
  });

  it('економія реальна: приховані тіла існують і їх помітно', () => {
    let hidden = 0;
    let total = 0;
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const p = publishCrystal(branches, material);
      hidden += p.bodies.length - p.renderable.length;
      total += p.bodies.length;
    }
    // Якби приховані тіла зникли, цей тест впав би й змусив перевірити, чи
    // економія ще потрібна — а не тихо лишив мертвий фільтр у сцені.
    expect(hidden).toBeGreaterThan(10);
    expect(hidden / total).toBeLessThan(0.6); // санітарна межа: не пів кристала
  });
});

describe('гейт публікації — `CAI-REQ-012`', () => {
  it('без обробки стику гейт НЕ пропускає стан', () => {
    // Доказ, що гейт здатен упасти: та сама маса без зрізу мусить дати
    // ok:false. Гейт, який не вміє відмовляти, нічого не гарантує.
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const raw = publishCrystal(branches, material, { skipTrim: true });
      expect(raw.ok, seed).toBe(false);
      expect(raw.shellViolations.length).toBeGreaterThan(0);
      expect(formatPublicationReport(raw)).not.toContain('гейт публікації: пройдено');
    }
  });

  it('гейт пропускає нормально зібраний стан', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      expect(publishCrystal(branches, material).ok, seed).toBe(true);
    }
  });

  it('опублікований стан незмінний (`V6-REQ-010`)', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const published = publishCrystal(branches, material);
    expect(Object.isFrozen(published)).toBe(true);
    expect(Object.isFrozen(published.bodies)).toBe(true);
    expect(() => {
      (published as { ok: boolean }).ok = false;
    }).toThrow();
  });
});
