import { describe, expect, it } from 'vitest';
import type { UserSizesRow } from '@/types';
import {
  SIZE_GROUPS,
  missingSizeLabels,
  readSize,
  sizeFieldsFor,
  sizeGroupsFor,
  sizesFilled,
  toSizesForm,
  toSizesPatch,
} from './sizesModel';

/*
 * ВИМОГА: модуль «Заміри» показує рівно ті заміри, які зберігає таблиця
 * `user_sizes` — не менше й не більше.
 *
 * Каталог полів колись жив у трьох місцях одразу (рядок таблиці, поле
 * форми, ключ стану форми), і забути одне з трьох означало замір, який
 * зберігається й ніде не видно. Тепер перелік один, і цей файл тримає
 * його чесним.
 */

const EMPTY: UserSizesRow = {
  user_id: 1,
  height: null,
  chest: null,
  waist: null,
  hips: null,
  intl_size: null,
  eu_size: null,
  ua_size: null,
  insole_cm: null,
  shoe_eu: null,
  shoe_us: null,
  bra: null,
  underwear: null,
  ring_ring: null,
  ring_index: null,
};

describe('каталог замірів', () => {
  it('покриває кожну колонку таблиці, крім ключа', () => {
    /*
     * Ключ перевірки — саме тип рядка, а не список, переписаний сюди
     * руками: коли в таблиці з'явиться нова колонка, `EMPTY` перестане
     * компілюватись без неї, а цей тест — проходити без поля в каталозі.
     */
    const columns = Object.keys(EMPTY).filter((name) => name !== 'user_id').sort();
    const catalogue = SIZE_GROUPS.flatMap((group) => group.fields.map((field) => field.key)).sort();
    expect(catalogue).toEqual(columns);
  });

  it('не називає двох замірів однаково', () => {
    // Два однакові підписи в одному списку — це не дублікат коду, це
    // екран, на якому не видно, котре з двох чисел чиє.
    const labels = SIZE_GROUPS.flatMap((group) => group.fields.map(
      (field) => `${group.title}/${field.label}`,
    ));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('ховає жіночу групу від чоловічого профілю', () => {
    expect(sizeGroupsFor(true).some((group) => group.title === 'Білизна')).toBe(true);
    expect(sizeGroupsFor(false).some((group) => group.title === 'Білизна')).toBe(false);
    expect(sizeFieldsFor(false).length).toBeLessThan(sizeFieldsFor(true).length);
  });
});

describe('читання заміру', () => {
  it('порожній рядок — це «не заповнено», а не значення', () => {
    // Три різні «немає» (`null`, `undefined`, `''`) сторінка показувала б
    // по-різному; тут вони зводяться в один стан.
    expect(readSize({ ...EMPTY, eu_size: '' }, 'eu_size')).toBeNull();
    expect(readSize({ ...EMPTY, eu_size: '  ' }, 'eu_size')).toBeNull();
    expect(readSize(null, 'eu_size')).toBeNull();
    expect(readSize({ ...EMPTY, eu_size: 'M' }, 'eu_size')).toBe('M');
  });

  it('віддає число рядком, готовим до копіювання', () => {
    // Копіюється значення БЕЗ одиниці: у поле пошуку магазину треба «38».
    expect(readSize({ ...EMPTY, height: 168 }, 'height')).toBe('168');
  });

  it('рахує заповнене й називає незаповнене', () => {
    const sizes: UserSizesRow = { ...EMPTY, height: 168, eu_size: '38' };
    expect(sizesFilled(sizes, false)).toEqual({ filled: 2, total: sizeFieldsFor(false).length });
    const missing = missingSizeLabels(sizes, false);
    expect(missing).not.toContain('Зріст');
    expect(missing).toContain('Талія');
    // Жіночі заміри не потрапляють у «ще не заповнено» чоловічого профілю.
    expect(missing).not.toContain('Бюстгальтер');
  });
});

describe('форма', () => {
  it('заповнюється з рядка й повертається в нього', () => {
    const sizes: UserSizesRow = { ...EMPTY, height: 168, insole_cm: 24.5, eu_size: '38' };
    const form = toSizesForm(sizes);
    expect(form.height).toBe('168');
    expect(form.insole_cm).toBe('24.5');
    expect(form.waist).toBe('');

    const patch = toSizesPatch(form, 7, false);
    expect(patch.user_id).toBe(7);
    expect(patch.height).toBe(168);
    expect(patch.insole_cm).toBe(24.5);
    expect(patch.eu_size).toBe('38');
    expect(patch.waist).toBeNull();
  });

  it('стирає замір, коли поле очистили', () => {
    // Інакше «прибрати неправильне число» було б неможливо: порожнє поле
    // просто не доїхало б до бази.
    const form = toSizesForm({ ...EMPTY, height: 168 });
    form.height = '';
    expect(toSizesPatch(form, 1, false).height).toBeNull();
  });

  it('не лишає в базі замірів, яких профілю не показують', () => {
    /*
     * Жіночі поля, введені колись помилково, інакше жили б у базі
     * назавжди: на екрані їх немає, тож стерти їх не було б чим.
     */
    const form = toSizesForm({ ...EMPTY, bra: '75B', underwear: 'M' });
    const patch = toSizesPatch(form, 1, false);
    expect(patch.bra).toBeNull();
    expect(patch.underwear).toBeNull();
    expect(toSizesPatch(form, 1, true).bra).toBe('75B');
  });

  it('не пише сміття замість числа', () => {
    const form = toSizesForm(EMPTY);
    form.height = 'приблизно';
    expect(toSizesPatch(form, 1, false).height).toBeNull();
  });
});
