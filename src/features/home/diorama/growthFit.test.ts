import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCrystalV2Model, type CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { buildCrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { buildTreeV2Geometry, treeV2Roots } from '@/engine/species/treeV2/geometry';
import { buildReefV2Model } from '@/engine/species/reefV2/model';
import { buildReefV2Geometry, reefV2Placements } from '@/engine/species/reefV2/geometry';
import { crystalV2Frame } from '../crystal3d/v2/crystalV2Frame';
import { treeV2Frame } from '../crystal3d/treeV2/treeV2Frame';
import { treeIslandBase, treeIslandGround } from '../crystal3d/treeV2/treeIsland';
import { reefV2Frame } from '../reef3d/v2/reefV2Frame';
import { buildReefIsland, inReefWater, reefIslandGround } from '../reef3d/v2/reefIsland';
import { DIORAMA_ISLAND_RADIUS, dioramaIslandRadius } from './dioramaStyle';
import { buildVolcanoModel } from '@/engine/species/volcano/model';
import { buildVolcanoGeometry, volcanoPlacements } from '@/engine/species/volcano/geometry';
import { volcanoFrame, volcanoIsland } from '../volcano3d/volcanoFrame';

// ============================================================
// Ріст пари × острови (ADR-0222, ADR-0223, ADR-0224).
// ------------------------------------------------------------
// Острови — оздоблення, а те, що на них росте, — дані пари. Ці тести
// проганяють модель кожного виду від першого року до сорокового, на
// порожній і на насиченій історії, і тримають одне: острів НЕ ховає й НЕ
// перекриває зароблене. Обидві знайдені вади жили саме тут:
//   * купол трави ховав коріння дерева (ефект «місць»): над травою не
//     виходила жодна точка коріння;
//   * лагуна й арка рифу стояли на сталих частках радіуса, а камінь рифу
//     з роками росте — колонії старшого рифу стали б у воду й під арку.
// Сцени рахують острів тими самими формулами, що й тут (`*Scene.tsx`).
// ============================================================

describe('уламки довкола островів', () => {
  it('пливуть нижче краю острова, а не над ним — над краєм вони затуляли кристал (регресія)', async () => {
    const { buildCrystalIsland } = await import('../crystal3d/v2/crystalIsland');
    const { buildTreeIsland } = await import('../crystal3d/treeV2/treeIsland');
    for (const mesh of [
      buildCrystalIsland('2022-12-26', 1.3).debris,
      buildTreeIsland('2022-12-26', 1.3).debris,
      buildReefIsland('2022-12-26', 1.3).debris,
    ]) {
      // Кавалок сягає ~1.25 свого розміру вгору від центру (0.15R максимум).
      for (let v = 1; v < mesh.positions.length; v += 3) expect(mesh.positions[v]!).toBeLessThan(0.05);
    }
  });
});

const TWIN =fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const busy = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;
const EMPTY = { startDate: '2022-12-26', partners: { red: 2, blue: 1 } };
const YEARS = [2023, 2024, 2026, 2030, 2040, 2062];
const cases = (['empty', 'busy'] as const).flatMap((history) => YEARS.map((year) => [history, year] as const));
const snapshot = (history: 'empty' | 'busy', year: number) =>
  ({ ...(history === 'busy' ? busy : EMPTY), asOf: `${year}-12-20` }) as CrystalV2Snapshot;

describe.each(cases)('%s, %i', (history, year) => {
  const snap = snapshot(history, year);

  it('дерево: коріння видно над травою — купол його не ховає (регресія)', () => {
    const model = buildTreeV2Model(snap as never);
    const frame = treeV2Frame(buildTreeV2Geometry(model));
    const island = dioramaIslandRadius(frame.reach * 0.9);
    // Кожен корінь — два відрізки; кінчик задуманий у землі, решта — над нею.
    let above = 0;
    let total = 0;
    for (const root of treeV2Roots(model)) {
      for (const p of [root.start, root.end]) {
        total += 1;
        const y = p[1] * frame.scale + treeIslandBase(island);
        if (y > treeIslandGround(island, Math.hypot(p[0], p[2]) * frame.scale)) above += 1;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(above / total).toBeGreaterThanOrEqual(0.7);
  });

  it('риф: вода й арка стоять за каменем, на якому ростуть колонії пари', () => {
    const model = buildReefV2Model(snap);
    const frame = reefV2Frame(buildReefV2Geometry(model));
    const rock = model.radius * frame.scale;
    const island = dioramaIslandRadius(Math.max(frame.reach * 1.1, rock * 1.55));
    const { water } = buildReefIsland(model.startDate, island, rock);
    expect(water.inner).toBeGreaterThan(rock);
    // Жодна колонія років не стоїть основою у воді.
    for (const place of reefV2Placements(model)) {
      expect(inReefWater(water, place.base[0] * frame.scale, place.base[2] * frame.scale)).toBe(false);
    }
  });

  it('риф: верхівка острова не вища за нуль моделі — зірки й молюски на ній, а не в ній (регресія)', () => {
    const model = buildReefV2Model(snap);
    const frame = reefV2Frame(buildReefV2Geometry(model));
    const island = dioramaIslandRadius(Math.max(frame.reach * 1.1, model.radius * frame.scale * 1.55));
    for (const t of [0, 0.3, 0.6, 0.9, 1]) expect(reefIslandGround(island, island * t)).toBeLessThan(0);
  });

  it('вулкан: скелет сцени той самий — острів не більший, ніж у кристала й дерева того ж віку (ADR-0235)', () => {
    // Власник: «скелет сцени має збігатись з деревом і кристалом (розмір
    // острова)». Було 1.76 проти 1.30 у пари ~4 років: камера відступала.
    const crystal = dioramaIslandRadius(crystalV2Frame(buildCrystalV2Geometry(buildCrystalV2Model(snap))).reach * 1.3);
    const tree = dioramaIslandRadius(treeV2Frame(buildTreeV2Geometry(buildTreeV2Model(snap as never))).reach * 0.9);
    const volcano = volcanoIsland(volcanoFrame(buildVolcanoGeometry(buildVolcanoModel(snap))));
    expect(volcano).toBeLessThanOrEqual(Math.max(crystal, tree) + 1e-9);
    if (year <= 2030) expect(volcano).toBe(DIORAMA_ISLAND_RADIUS);
  });

  it('вулкан: лагуна за підніжжям, жодна колонія основою не у воді', () => {
    const model = buildVolcanoModel(snap);
    const frame = volcanoFrame(buildVolcanoGeometry(model));
    const rock = model.baseRadius * frame.scale;
    const { water } = buildReefIsland(model.startDate, volcanoIsland(frame), rock, { arch: false });
    expect(water.inner).toBeGreaterThan(rock);
    for (const place of volcanoPlacements(model)) {
      expect(inReefWater(water, place.base[0] * frame.scale, place.base[2] * frame.scale)).toBe(false);
    }
  });

  it('кристал: колонія не дотягується до руїн по краю острова', () => {
    const geometry = buildCrystalV2Geometry(buildCrystalV2Model(snap));
    const frame = crystalV2Frame(geometry);
    const island = dioramaIslandRadius(frame.reach * 1.3);
    const p = geometry.crystals.positions;
    let reach = 0;
    for (let i = 0; i < p.length; i += 3) reach = Math.max(reach, Math.hypot(p[i]!, p[i + 2]!) * frame.scale);
    // Найближча до осі руїна — уламок колони на 0.78 радіуса мінус півширини.
    expect(reach).toBeLessThan(island * 0.74);
  });
});
