// ============================================================
// Сказане число — і головне, чого воно НЕ робить.
// ------------------------------------------------------------
// Найважливіший тут не перший тест, а «не рахує двічі». Сказане число —
// це єдине місце в порталі, де факт про життя пари береться зі слів, а не
// з рядка бази, і рівно тому воно мусить меншати, коли з'являється
// справжній рядок. Інакше пара, яка сказала «двадцять фільмів» і потім
// сумлінно завела двадцять, дістала б сорок.
// ============================================================
import { describe, expect, it } from 'vitest';
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';
import {
  DECLARED_MAX,
  declaredShortfall,
  padSnapshotWithDeclared,
  parseDeclaredCounts,
  serializeDeclaredCounts,
  withDeclared,
} from './declaredCounts';

const SPAN = { startsAt: '2022-12-26', endsAt: '2023-12-26' };
const NEXT = { startsAt: '2023-12-26', endsAt: '2024-12-26' };

/**
 * Знімок, у який тест дописує рядки.
 *
 * Поля знімка `readonly` — рушій не терпить мутації опублікованого стану,
 * — тож фікстура тримає власні масиви й збирає знімок із них. Це не обхід
 * типу: сам знімок так і лишається незмінним, міняється лише те, з чого
 * його щоразу складають.
 */
interface Bag {
  memories: EvolutionSourceSnapshot['memories'][number][];
  media: EvolutionSourceSnapshot['media'][number][];
  mapPlaces: EvolutionSourceSnapshot['mapPlaces'][number][];
}

const bag = (): Bag => ({ memories: [], media: [], mapPlaces: [] });

const snapshotOf = (rows: Bag = bag()): EvolutionSourceSnapshot => ({
  calendarEvents: [], plans: [], wishlistItems: [], memoryLinks: [],
  memories: rows.memories, media: rows.media, mapPlaces: rows.mapPlaces,
});

const empty = (): EvolutionSourceSnapshot => snapshotOf();

describe('читання сказаного числа', () => {
  it('порожнеча, сміття й чужа форма дають порожній запис, а не виняток', () => {
    // Значення в `settings` — вільний рядок; довіряти йому не можна.
    expect(parseDeclaredCounts(undefined)).toEqual({});
    expect(parseDeclaredCounts('')).toEqual({});
    expect(parseDeclaredCounts('{')).toEqual({});
    expect(parseDeclaredCounts('[1,2]')).toEqual({});
    expect(parseDeclaredCounts('null')).toEqual({});
    expect(parseDeclaredCounts(JSON.stringify({ 'not-a-year': { photos: 3 } }))).toEqual({});
  });

  it('обрізає до стелі, відкидає від\'ємне й дробове', () => {
    const parsed = parseDeclaredCounts(JSON.stringify({
      '2022-12-26': { photos: 999, movies: -4, series: 2.7, places: 0 },
    }));
    expect(parsed).toEqual({ '2022-12-26': { photos: DECLARED_MAX, series: 2 } });
  });

  it('запис і читання вертають те саме', () => {
    const counts = { '2022-12-26': { photos: 12, places: 3 } };
    expect(parseDeclaredCounts(serializeDeclaredCounts(counts))).toEqual(counts);
  });

  it('нуль не зберігається — його відсутність і Є нуль', () => {
    expect(serializeDeclaredCounts({ '2022-12-26': { photos: 0 } })).toBe('{}');
  });

  it('ключі впорядковані, тож той самий запис дає той самий рядок', () => {
    const forward = serializeDeclaredCounts({ '2023-12-26': { photos: 1 }, '2022-12-26': { photos: 2 } });
    const backward = serializeDeclaredCounts({ '2022-12-26': { photos: 2 }, '2023-12-26': { photos: 1 } });
    expect(forward).toBe(backward);
  });

  it('прибирає рік цілком, коли в ньому не лишилось жодного числа', () => {
    const one = withDeclared({}, SPAN.startsAt, 'photos', 5);
    expect(one).toEqual({ '2022-12-26': { photos: 5 } });
    expect(withDeclared(one, SPAN.startsAt, 'photos', 0)).toEqual({});
  });
});

describe('різниця між сказаним і справжнім', () => {
  it('НЕ РАХУЄ ДВІЧІ: справжні рядки віднімаються від сказаного', () => {
    /*
     * Головний інваріант файла. Пара сказала «дванадцять фільмів», потім
     * завела п'ять справжніх — домішки має лишитись сім, а не дванадцять.
     */
    const rows = bag();
    for (let index = 0; index < 5; index += 1) {
      rows.media.push({
        id: index, status: 'done',
        createdAt: '2023-05-01T00:00:00.000Z', finishedAt: '2023-05-01T00:00:00.000Z',
      });
    }
    const missing = declaredShortfall(snapshotOf(rows), { movies: 12 }, SPAN);
    expect(missing.movies).toBe(7);
  });

  it('не йде в мінус, коли справжніх більше за сказане', () => {
    const rows = bag();
    for (let index = 0; index < 9; index += 1) {
      rows.mapPlaces.push({
        id: index, category: 'other', visitedAt: '2023-05-01',
        createdAt: '2023-05-01T00:00:00.000Z', rating: null, city: null, country: null,
      });
    }
    expect(declaredShortfall(snapshotOf(rows), { places: 4 }, SPAN).places).toBe(0);
  });

  it('справжні рядки ІНШОГО року не зараховуються', () => {
    const rows = bag();
    rows.memories.push({
      id: 1, memoryDate: '2024-05-01', datePrecision: 'day',
      takenAt: null, createdAt: '2024-05-01T00:00:00.000Z',
    });
    expect(declaredShortfall(snapshotOf(rows), { photos: 3 }, SPAN).photos).toBe(3);
  });

  it('фільми й серіали діляться між собою пропорційно сказаному', () => {
    /*
     * Рушій їх не розрізняє — у знімку медіа має лише стан і дату. Пара
     * розрізняє, тож екран питає окремо, а нестача ділиться в тій самій
     * пропорції: сказано 9 і 3, переглянуто 4, лишається 6 і 2.
     */
    const rows = bag();
    for (let index = 0; index < 4; index += 1) {
      rows.media.push({
        id: index, status: 'done',
        createdAt: '2023-05-01T00:00:00.000Z', finishedAt: '2023-05-01T00:00:00.000Z',
      });
    }
    const missing = declaredShortfall(snapshotOf(rows), { movies: 9, series: 3 }, SPAN);
    expect(missing.movies + missing.series).toBe(8);
    expect(missing.movies).toBe(6);
    expect(missing.series).toBe(2);
  });
});

describe('домішка до знімка', () => {
  it('без сказаних чисел вертає ТОЙ САМИЙ знімок, а не копію', () => {
    // Інакше кожне читання порталу виглядало б зміною для всіх, хто
    // порівнює знімки між собою.
    const snapshot = empty();
    expect(padSnapshotWithDeclared(snapshot, {}, [SPAN]).snapshot).toBe(snapshot);
  });

  it('кладе рівно стільки, скільки бракує, і всередині свого року', () => {
    const { snapshot: padded } = padSnapshotWithDeclared(
      empty(), { '2022-12-26': { photos: 4, places: 2 } }, [SPAN, NEXT],
    );
    expect(padded.memories).toHaveLength(4);
    expect(padded.mapPlaces).toHaveLength(2);
    for (const row of padded.memories) {
      expect(row.memoryDate >= SPAN.startsAt).toBe(true);
      expect(row.memoryDate < SPAN.endsAt).toBe(true);
    }
  });

  it('НЕ ЧІПАЄ справжніх рядків', () => {
    const rows = bag();
    rows.memories.push({
      id: 1, memoryDate: '2023-05-01', datePrecision: 'day',
      takenAt: '2023-05-01T10:00:00.000Z', createdAt: '2023-05-01T10:00:00.000Z',
    });
    const snapshot = snapshotOf(rows);
    const { snapshot: padded } = padSnapshotWithDeclared(
      snapshot, { '2022-12-26': { photos: 3 } }, [SPAN],
    );
    expect(padded.memories[0]).toBe(snapshot.memories[0]);
    // Три сказані мінус один справжній.
    expect(padded.memories).toHaveLength(3);
  });

  it('детермінована: те саме число дає ті самі дні', () => {
    const once = padSnapshotWithDeclared(empty(), { '2022-12-26': { photos: 7 } }, [SPAN]);
    const twice = padSnapshotWithDeclared(empty(), { '2022-12-26': { photos: 7 } }, [SPAN]);
    expect(once.snapshot.memories).toEqual(twice.snapshot.memories);
  });

  it('порядок років у списку не міняє результату', () => {
    const counts = { '2022-12-26': { photos: 2 }, '2023-12-26': { photos: 3 } };
    const forward = padSnapshotWithDeclared(empty(), counts, [SPAN, NEXT]);
    const backward = padSnapshotWithDeclared(empty(), counts, [NEXT, SPAN]);
    expect(forward.snapshot.memories).toEqual(backward.snapshot.memories);
  });

  it('домішані ідентифікатори не стикаються зі справжніми', () => {
    const rows = bag();
    rows.memories.push({
      id: 42, memoryDate: '2019-01-01', datePrecision: 'day',
      takenAt: null, createdAt: '2019-01-01T00:00:00.000Z',
    });
    const { snapshot: padded } = padSnapshotWithDeclared(
      snapshotOf(rows), { '2022-12-26': { photos: 2 } }, [SPAN],
    );
    const ids = padded.memories.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids.filter((id) => id !== 42))).toBeGreaterThan(1_000_000);
  });

  it('точність домішаного знімка — РІК, бо саме рік і назвали', () => {
    const { snapshot: padded } = padSnapshotWithDeclared(
      empty(), { '2022-12-26': { photos: 1 } }, [SPAN],
    );
    expect(padded.memories[0]!.datePrecision).toBe('year');
    expect(padded.memories[0]!.takenAt).toBeNull();
  });

  it('ВЕРТАЄ РІЗНИЦЮ РАЗОМ ІЗ ЗНІМКОМ — порахувати її вдруге вже нічим', () => {
    /*
     * Вада, спіймана на собі: екран рахував різницю, покликавши
     * `declaredShortfall` на знімку, який УЖЕ містив домішку, — і виходив
     * нуль. Пара побачила б «усі 24 знімки вже названі» рівно тоді, коли
     * не названо жодного. Різниця існує лише в мить домішування.
     */
    const { snapshot: padded, gaps } = padSnapshotWithDeclared(
      empty(), { '2022-12-26': { photos: 5, places: 2 } }, [SPAN],
    );
    expect(gaps['2022-12-26']).toEqual({ photos: 5, movies: 0, series: 0, places: 2 });
    expect(declaredShortfall(padded, { photos: 5 }, SPAN).photos).toBe(0);
  });
});
