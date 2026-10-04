import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCrystalV2Model, type CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { chronicleTraces } from '@/engine/species/grammar/chronicle';
import { treeV2Ornaments, treeV2Skeleton } from '@/engine/species/treeV2/geometry';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { volcanoOrnaments } from '@/engine/species/volcano/geometry';
import { buildVolcanoModel } from '@/engine/species/volcano/model';
import { MODULE_TRACE, chronicleAnchor, type ChronicleSubject } from './anchors';

// ============================================================
// Опорні точки хроніки (ADR-0238, власник: «виконані бажання зумують ту
// частину, на яку впливають, плани … відводять камеру в частину об'єкта,
// яку вони ростять»). Точка береться з тієї самої геометрії, що малює
// частину, — тест тримає саме це, а не «десь на об'єкті».
// ============================================================

const TWIN = fileURLToPath(new URL('../../../tools/crystal_twin/', import.meta.url));
const BUSY = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;
const traces = chronicleTraces(BUSY);

const subjects: ChronicleSubject[] = [
  { species: 'crystal', model: buildCrystalV2Model(BUSY) },
  { species: 'tree', model: buildTreeV2Model(BUSY), form: 'oak' },
  { species: 'tree', model: buildTreeV2Model(BUSY), form: 'spruce' },
  { species: 'reef', model: buildVolcanoModel(BUSY) },
];

describe('опорні точки хроніки', () => {
  it.each(subjects.map((s) => [s.species, s] as const))('%s: кожен запис має скінченну точку й підхід ближче за звичайний кадр', (_, subject) => {
    for (const trace of traces) {
      const anchor = chronicleAnchor(subject, trace);
      for (const v of anchor.point) expect(Number.isFinite(v)).toBe(true);
      expect(anchor.zoom).toBeGreaterThan(0);
      expect(anchor.zoom).toBeLessThan(1);
    }
  });

  it('дерево: бажання — рівно до своєї квітки; план — до гілки верхівки', () => {
    const model = buildTreeV2Model(BUSY);
    const subject: ChronicleSubject = { species: 'tree', model, form: 'oak' };
    const { branches, clusters } = treeV2Skeleton(model, 'oak');
    const orn = treeV2Ornaments(model, clusters);
    const wish = traces.filter((t) => t.kind === 'wishes').at(-1)!;
    const k = model.blossoms.findIndex((b) => b.id === wish.id);
    expect(chronicleAnchor(subject, wish).point).toEqual(orn.blossoms[k]!.position);
    const plan = traces.find((t) => t.kind === 'plans')!;
    const limbEnds = branches.filter((b) => /^c\d+$/.test(b.key)).map((b) => b.end);
    expect(limbEnds).toContainEqual(chronicleAnchor(subject, plan).point);
  });

  it('вулкан: бажання — до своєї актинії; план без тріщин чесно каже, куди дивиться замість нього', () => {
    const model = buildVolcanoModel(BUSY);
    const orn = volcanoOrnaments(model);
    const wish = traces.filter((t) => t.kind === 'wishes').at(-1)!;
    const k = model.life.anemones.findIndex((a) => a.id === wish.id);
    expect(chronicleAnchor({ species: 'reef', model }, wish).point).toEqual(orn.anemones[k]!.position);
    const bare = buildVolcanoModel({ ...BUSY, plans: [] });
    const plan = { kind: 'plans' as const, id: 1, date: BUSY.asOf.slice(0, 10), year: 0, index: 0 };
    expect(chronicleAnchor({ species: 'reef', model: bare }, plan).note).toMatch(/[Тт]ріщин/);
  });

  it('кристал: вихідний — до своєї друзи на острові', () => {
    const day = { kind: 'daysOff' as const, id: '2024-05-05', date: '2024-05-05', year: 1, index: 0 };
    expect(chronicleAnchor(subjects[0]!, day).space).toBe('island');
  });

  it('кожен модуль у кожному виді має підпис, що він ростить', () => {
    for (const species of ['crystal', 'tree', 'reef'] as const) {
      for (const text of Object.values(MODULE_TRACE[species])) expect(text.length).toBeGreaterThan(10);
    }
  });
});
