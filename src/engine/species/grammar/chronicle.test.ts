import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '../crystalV2/model';
import { chronicleDateAt, chronicleMonths, chronicleTraces } from './chronicle';

// ============================================================
// Хроніка росту (ADR-0238): записи, що виростили об'єкт, — лише справжні
// й лише ті, що ріст бачить (у межах історії пари на дату знімка).
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const BUSY = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;

describe('хроніка: записи пари', () => {
  it('від найдавнішого, кожен у межах історії пари, з роком і номером у своєму модулі', () => {
    const traces = chronicleTraces(BUSY);
    expect(traces.length).toBeGreaterThan(0);
    for (let i = 1; i < traces.length; i += 1) expect(traces[i]!.date >= traces[i - 1]!.date).toBe(true);
    for (const t of traces) {
      expect(t.date >= BUSY.startDate.slice(0, 10) && t.date <= BUSY.asOf.slice(0, 10)).toBe(true);
      expect(t.year).toBeGreaterThanOrEqual(0);
    }
    const byKind = new Map<string, number[]>();
    for (const t of traces) byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t.index]);
    for (const indices of byKind.values()) expect(indices).toEqual(indices.map((_, i) => i));
  });

  it('віха — окремо від звичайної події; бажання несе колір того, хто виконав', () => {
    const traces = chronicleTraces({
      startDate: '2020-01-01', asOf: '2022-01-01', partners: { red: 2, blue: 1 },
      events: [{ id: 1, date: '2020-05-05', isMilestone: true }, { id: 2, date: '2020-06-06' }],
      wishes: [{ id: 9, date: '2021-01-01', ownerId: 1, fulfilledById: 2 }],
    });
    expect(traces.map((t) => [t.kind, t.id])).toEqual([['milestones', 1], ['events', 2], ['wishes', 9]]);
    expect(traces[2]!.channel).toBe('red');
  });

  it('записи до початку стосунків і після дати знімка не показуються — їх не бачить і ріст', () => {
    const traces = chronicleTraces({
      startDate: '2020-01-01', asOf: '2021-01-01', partners: {},
      memories: [{ id: 1, date: '1971-03-03' }, { id: 2, date: '2020-03-03' }, { id: 3, date: '2030-01-01' }],
    });
    expect(traces.map((t) => t.id)).toEqual([2]);
  });
});

describe('хроніка: повзунок часу по місяцях', () => {
  it('місяців між початком і знімком — стільки, скільки повних місяців минуло', () => {
    expect(chronicleMonths('2022-12-26', '2022-12-26')).toBe(0);
    expect(chronicleMonths('2022-12-26', '2023-01-25')).toBe(0);
    expect(chronicleMonths('2022-12-26', '2023-01-26')).toBe(1);
    expect(chronicleMonths('2022-12-26', '2026-09-29')).toBe(45);
  });

  it('дата на повзунку — той самий день місяця, короткий місяць — його останній день, не пізніше знімка', () => {
    expect(chronicleDateAt('2022-12-26', '2026-09-29', 0)).toBe('2022-12-26');
    expect(chronicleDateAt('2022-12-26', '2026-09-29', 14)).toBe('2024-02-26');
    expect(chronicleDateAt('2023-01-31', '2026-09-29', 1)).toBe('2023-02-28');
    expect(chronicleDateAt('2024-01-31', '2026-09-29', 1)).toBe('2024-02-29');
    expect(chronicleDateAt('2022-12-26', '2026-09-29', 999)).toBe('2026-09-29');
  });
});
