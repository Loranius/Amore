import { describe, expect, it } from 'vitest';
import { planPhotoImport, type DatedPhoto } from './photoImport';
import type { RelationshipYearFill } from './yearFills';

// ============================================================
// Розкладка світлин по роках — єдине місце, де це можна перевірити.
// ------------------------------------------------------------
// Композер спогадів кладе будь-яку кількість файлів в ОДИН спогад,
// датований EXIF-ом першого. Двісті світлин за вісім років стали б одним
// днем, а роки лишились би порожніми — тобто гуртовий імпорт без
// групування не просто марний, він створює видимість роботи.
//
// Файли тут не потрібні: функція дивиться лише на `takenAt`, і саме тому
// вона окрема від завантаження.
// ============================================================

const YEARS: RelationshipYearFill[] = [1, 2, 3].map((index) => ({
  index,
  label: 2021 + index,
  startsAt: `${2021 + index}-06-10`,
  endsAt: `${2022 + index}-06-10`,
  complete: index < 3,
  fill: 0.3,
}));

const TODAY = '2025-01-15';

/** Світлина, від якої потрібен лише час зйомки. */
const shot = (takenAt: string | null, name = 'IMG'): DatedPhoto<string> => ({
  file: `${name}:${takenAt ?? 'none'}`,
  takenAt,
});

describe('світлини розкладаються по днях і роках', () => {
  it('день зйомки — один спогад, а не один спогад на все', () => {
    /*
     * Заради цього функція й існує. Три дні в трьох різних роках мають
     * дати ТРИ спогади; композер дав би один.
     */
    const plan = planPhotoImport([
      shot('2022-08-14T10:00:00Z'),
      shot('2022-08-14T18:30:00Z'),
      shot('2023-09-02T12:00:00Z'),
      shot('2024-07-20T09:00:00Z'),
    ], YEARS, TODAY);

    expect(plan.days.map((day) => day.day)).toEqual(['2022-08-14', '2023-09-02', '2024-07-20']);
    expect(plan.days[0]!.photos).toHaveLength(2);
    expect(plan.photoCount).toBe(4);
  });

  it('дні лягають у РОКИ СТОСУНКІВ, а не в календарні', () => {
    /*
     * Рік тут іде з 10 червня по 9 червня. Дві світлини в одному
     * календарному 2023-му належать РІЗНИМ рокам пари, і саме через це
     * онбординг уже одного разу помилився в тесті наповненості.
     */
    const plan = planPhotoImport([
      shot('2023-05-01T10:00:00Z'),
      shot('2023-08-01T10:00:00Z'),
    ], YEARS, TODAY);

    expect(plan.days.map((day) => day.yearIndex)).toEqual([1, 2]);
    expect([...plan.daysByYear.entries()].sort()).toEqual([[1, 1], [2, 1]]);
  });

  it('світлина без дати не імпортується й не зникає з рахунку', () => {
    /*
     * Вигадати дату не можна: спогад із вигаданим днем гірший за
     * відсутній. Але й змовчати не можна — «209 з 300» без пояснення
     * виглядає як збій.
     */
    const plan = planPhotoImport([
      shot(null),
      shot(null),
      shot('2022-08-14T10:00:00Z'),
    ], YEARS, TODAY);

    expect(plan.undated).toBe(2);
    expect(plan.photoCount).toBe(1);
  });

  it('світлини до початку стосунків не потрапляють у «нашу історію»', () => {
    /*
     * Вони справжні, але рушій рахує роки від дати початку, і такий день
     * не належить жодному. Мовчки заводити їх у портал теж не можна:
     * пара легко вибирає всю плівку телефона.
     */
    const plan = planPhotoImport([
      shot('2019-04-01T10:00:00Z'),
      shot('2022-06-09T10:00:00Z'),
    ], YEARS, TODAY);

    expect(plan.days).toEqual([]);
    expect(plan.outside).toBe(2);
  });

  it('дата в майбутньому відкидається — годинник камери буває збитий', () => {
    /*
     * `readExifTakenAt` ловить ненастроєний годинник і неможливі дати,
     * але не збитий на рік уперед. Спогад, датований наступним місяцем,
     * зіпсував би поточний рік тихо.
     */
    const plan = planPhotoImport([shot('2025-03-01T10:00:00Z')], YEARS, TODAY);

    expect(plan.days).toEqual([]);
    expect(plan.outside).toBe(1);
  });

  it('день сьогоднішній ще належить історії', () => {
    // Межа включна: знімок, зроблений годину тому, — це спогад, а не майбутнє.
    const plan = planPhotoImport([shot(`${TODAY}T08:00:00Z`)], YEARS, TODAY);

    expect(plan.days).toHaveLength(1);
    expect(plan.outside).toBe(0);
  });

  it('порядок детермінований — і по днях, і всередині дня', () => {
    /*
     * Перше фото дня стає ОБКЛАДИНКОЮ спогаду (`create` бере `saved[0]`).
     * Без сортування обкладинка залежала б від того, у якому порядку
     * файловий діалог віддав файли, — тобто від операційної системи.
     */
    const plan = planPhotoImport([
      shot('2023-09-02T18:00:00Z', 'вечір'),
      shot('2022-08-14T10:00:00Z', 'раніший день'),
      shot('2023-09-02T07:00:00Z', 'ранок'),
    ], YEARS, TODAY);

    expect(plan.days.map((day) => day.day)).toEqual(['2022-08-14', '2023-09-02']);
    expect(plan.days[1]!.photos.map((photo) => photo.file))
      .toEqual(['ранок:2023-09-02T07:00:00Z', 'вечір:2023-09-02T18:00:00Z']);
  });

  it('порожній вибір — порожній план, а не помилка', () => {
    const plan = planPhotoImport([], YEARS, TODAY);

    expect(plan).toEqual({
      days: [], photoCount: 0, undated: 0, outside: 0, daysByYear: new Map(),
    });
  });
});
