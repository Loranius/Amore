// ============================================================
// Каталог замірів — що саме пара про себе записала.
// ------------------------------------------------------------
// ЧОМУ ЦЕ ДАНІ, А НЕ РОЗМІТКА. Доти кожен замір існував у трьох місцях
// одразу: рядком у таблиці перегляду, полем у формі й ключем у стані
// форми. Додати «обхват шиї» означало б не забути про жодне з трьох, а
// забути — означало б поле, яке зберігається й ніде не видно.
//
// Тут перелік один, і сторінка з формою обидві читають його. Тест
// `sizesModel.test.ts` звіряє його з КОЛОНКАМИ ТАБЛИЦІ: заміри, якого
// немає в каталозі, не існує.
// ============================================================
import type { InsertRow, UserSizesRow } from '@/types';

/** Колонки таблиці, які є замірами (тобто все, крім ключа). */
export type SizeKey = Exclude<keyof UserSizesRow, 'user_id'>;

export interface SizeField {
  key: SizeKey;
  /** Підпис словом пари — коротко, бо стоїть ліворуч від числа. */
  label: string;
  /**
   * Одиниця, якщо вона є.
   *
   * Окремо від значення навмисно: у рядку вона малюється тихішою й
   * дрібнішою, щоб око падало на ЧИСЛО. І саме тому копіюється теж без
   * неї — у поле пошуку магазину треба «38», а не «38 см».
   */
  unit?: string;
  /** Числове поле показує на телефоні цифрову клавіатуру. */
  numeric: boolean;
  /** Крок для дробових (устілка міряється з половинками). */
  step?: number;
}

export interface SizeGroup {
  title: string;
  /**
   * Група лише для жіночого профілю.
   *
   * Правило те саме, що стояло в налаштуваннях, і воно навмисно просте:
   * у порталі рівно двоє людей, і жодного поля «стать» у них немає.
   * Заводити колонку заради двох рядків — більше коду, ніж користі.
   */
  femaleOnly?: boolean;
  fields: readonly SizeField[];
}

/** Ім'я, за яким показується жіноча група. Те саме, що й у налаштуваннях. */
export const FEMALE_NAME = 'Лєна';

export const SIZE_GROUPS: readonly SizeGroup[] = [
  {
    title: 'Габарити',
    fields: [
      { key: 'height', label: 'Зріст', unit: 'см', numeric: true },
      { key: 'chest', label: 'Груди', unit: 'см', numeric: true },
      { key: 'waist', label: 'Талія', unit: 'см', numeric: true },
      { key: 'hips', label: 'Стегна', unit: 'см', numeric: true },
    ],
  },
  {
    title: 'Одяг',
    fields: [
      { key: 'intl_size', label: 'Міжнародний', numeric: false },
      { key: 'eu_size', label: 'Європейський', numeric: false },
      { key: 'ua_size', label: 'Український', numeric: false },
    ],
  },
  {
    title: 'Взуття',
    fields: [
      { key: 'insole_cm', label: 'Устілка', unit: 'см', numeric: true, step: 0.5 },
      { key: 'shoe_eu', label: 'Європейський', numeric: false },
      { key: 'shoe_us', label: 'Американський', numeric: false },
    ],
  },
  {
    title: 'Білизна',
    femaleOnly: true,
    fields: [
      { key: 'bra', label: 'Бюстгальтер', numeric: false },
      { key: 'underwear', label: 'Труси', numeric: false },
    ],
  },
  {
    title: 'Каблучки',
    fields: [
      { key: 'ring_ring', label: 'Безіменний палець', numeric: false },
      { key: 'ring_index', label: 'Вказівний палець', numeric: false },
    ],
  },
];

/** Групи, які показуються цьому профілю. */
export function sizeGroupsFor(isFemale: boolean): readonly SizeGroup[] {
  return isFemale ? SIZE_GROUPS : SIZE_GROUPS.filter((group) => group.femaleOnly !== true);
}

/** Усі поля цього профілю, без груп. */
export function sizeFieldsFor(isFemale: boolean): readonly SizeField[] {
  return sizeGroupsFor(isFemale).flatMap((group) => group.fields);
}

/**
 * Значення заміру рядком — або `null`, якщо його не заповнили.
 *
 * `null` окремо від порожнього рядка навмисно: сторінка ховає незаповнені
 * заміри, а не малює стіну прочерків, тож «немає» мусить бути одним
 * станом, а не трьома (`null`, `undefined`, `''`).
 */
export function readSize(sizes: UserSizesRow | null, key: SizeKey): string | null {
  const raw = sizes?.[key];
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  return text === '' ? null : text;
}

/** Скільки замірів заповнено з тих, які показуються цьому профілю. */
export function sizesFilled(
  sizes: UserSizesRow | null,
  isFemale: boolean,
): { filled: number; total: number } {
  const fields = sizeFieldsFor(isFemale);
  return {
    filled: fields.filter((field) => readSize(sizes, field.key) !== null).length,
    total: fields.length,
  };
}

/** Підписи незаповнених замірів — рядком «ще не заповнено». */
export function missingSizeLabels(
  sizes: UserSizesRow | null,
  isFemale: boolean,
): readonly string[] {
  return sizeFieldsFor(isFemale)
    .filter((field) => readSize(sizes, field.key) === null)
    .map((field) => field.label);
}

/** Стан форми: усі заміри рядками, бо саме рядки тримають поля вводу. */
export type SizesFormState = Record<SizeKey, string>;

export function toSizesForm(sizes: UserSizesRow | null): SizesFormState {
  const form = {} as SizesFormState;
  for (const group of SIZE_GROUPS) {
    for (const field of group.fields) form[field.key] = readSize(sizes, field.key) ?? '';
  }
  return form;
}

/**
 * Форма → рядок таблиці.
 *
 * Поля, яких цьому профілю не показують, пишуться як `null`, а не
 * лишаються як були: інакше замір, введений колись помилково, жив би в
 * базі назавжди й ніде не показувався — тобто його неможливо було б
 * стерти.
 */
export function toSizesPatch(
  form: SizesFormState,
  userId: number,
  isFemale: boolean,
): InsertRow<'user_sizes'> {
  const shown = new Set(sizeFieldsFor(isFemale).map((field) => field.key));
  const patch = { user_id: userId } as InsertRow<'user_sizes'>;
  for (const group of SIZE_GROUPS) {
    for (const field of group.fields) {
      const text = shown.has(field.key) ? (form[field.key] ?? '').trim() : '';
      if (text === '') {
        (patch as Record<string, unknown>)[field.key] = null;
        continue;
      }
      if (field.numeric) {
        const value = Number.parseFloat(text);
        (patch as Record<string, unknown>)[field.key] = Number.isFinite(value) ? value : null;
      } else {
        (patch as Record<string, unknown>)[field.key] = text;
      }
    }
  }
  return patch;
}
