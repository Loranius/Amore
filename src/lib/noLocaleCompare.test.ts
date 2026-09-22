import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Друга заборона, яку тепер хтось перевіряє.
// ------------------------------------------------------------
// `DETERMINISM_STANDARD.md` §4: «Canonical ordering uses an explicit
// comparator over normalized strings and numeric keys. **Do not use
// `localeCompare`.**» На момент появи цього сторожа в `src/` було
// **49 викликів**, із них 19 у рушії.
//
// Це та сама форма, що вже трапилась із `Math.random()`: заборона без
// адреси, куди йти натомість, не виконується — і сорок дев'ять порушень
// накопичились, кожне з виглядом безневинного рядка.
//
// РІЗНИЦЯ З `noRawRandom.test.ts` ІСТОТНА, І ВОНА НА КОРИСТЬ СУВОРОСТІ.
// Там заборона мусила ослабнути, бо випадковість подекуди і є суттю
// кнопки. Тут — навпаки: жодне з 49 місць не потребувало мови телефона.
// Усі сортували ключі, ISO-дати або текст, порядок якого мусить збігатись
// в обох партнерів. Тому тут нуль, а не «одна адреса з причинами».
//
// ЧОМУ ЦЕ НЕ ГІГІЄНА. Виміряно на справжніх назвах міст: `Їжаківка` та
// `Ізмаїл` міняються місцями між `en-US` і `uk-UA`. Пісочниця, у якій
// знімаються ВСІ докази цього проєкту, рахує під `en-US`; телефон пари —
// під `uk-UA`. `growthEvents.ts` сортує місця за назвою, і цей порядок
// задає ранг шпиля.
//
// І окремо варте запису: увесь набір тестів проходив під `uk_UA.UTF-8`
// так само зелено, як під `en-US`. Тобто жоден наявний тест цю
// залежність НЕ бачив — що й є причиною, чому сторож мусить дивитись у
// текст, а не чекати, поки щось само впаде.
// ============================================================

const SRC = join(__dirname, '..');
const ORDERING = join(SRC, 'engine', 'ordering', 'index.ts');

/**
 * Два файли, яким вільно вживати заборонене слово в КОДІ, і чому саме їм.
 *
 * Сторож, який не може показати, від чого стереже, доводить менше, ніж
 * здається: щоб перевірити «дві локалі розходяться», треба цих локалей
 * спитати — тобто викликати те, що заборонено. Тому виняток рівно два, і
 * обидва названі поіменно, а не шаблоном на теку.
 *
 * Цей файл у списку через власну перевірку на мутацію нижче: вона шукає
 * слово як РЯДОК, і сканер, який дивиться на `includes`, його теж бачить.
 */
const PROOF = join(SRC, 'engine', 'ordering', 'index.test.ts');

const ALLOWED = new Set([
  ORDERING,                                                // сам компаратор: пояснює, що замінює
  PROOF,                                                   // доказ, що локалі розходяться
  join(SRC, 'lib', 'noLocaleCompare.test.ts'),             // цей сторож: слово-голка в рядку
]);

/** Текст без коментарів; рядки збережено, щоб номер у звіті був правдивий. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    out.push(path);
  }
  return out;
}

/** `файл:рядок` для кожного входження поза коментарями. */
function occurrences(paths: readonly string[], needle: string): string[] {
  const found: string[] = [];
  for (const path of paths) {
    stripComments(readFileSync(path, 'utf8')).split('\n').forEach((line, index) => {
      if (line.includes(needle)) {
        found.push(`${relative(SRC, path).split(sep).join('/')}:${index + 1}`);
      }
    });
  }
  return found;
}

describe('порядок рядків не залежить від мови телефона', () => {
  it('у `src/` немає жодного `localeCompare` поза коментарями', () => {
    /*
     * Тести теж скануються, і це навмисно: тест, який сортує через
     * `localeCompare`, стверджує порядок, якого продукт не дає, — і
     * зеленітиме саме тоді, коли продукт зламається.
     */
    const all = sourceFiles(SRC).filter((path) => !ALLOWED.has(path));
    expect(occurrences(all, 'localeCompare')).toEqual([]);
  });

  it('коментарям говорити про заборону вільно', () => {
    /*
     * Зворотний бік: `features/onboarding/sweepEntries.ts` пояснює свою
     * відмову словом `localeCompare` у коментарі, і це найкорисніший
     * абзац у всій цій історії — саме він показав, що правило в проєкті
     * ЗНАЛИ. Сканер, який його забороняє, карав би за пояснення.
     */
    const sweep = join(SRC, 'features', 'onboarding', 'sweepEntries.ts');
    expect(readFileSync(sweep, 'utf8')).toContain('localeCompare');
    expect(occurrences([sweep], 'localeCompare')).toEqual([]);
  });

  it('сам сканер щось ловить', () => {
    /*
     * Без цього два зелені тести вище не доводять нічого: сканер, який
     * не знаходить нічого ніде, зелений і на зламаному коді. Цей проєкт
     * уже ловив себе на такому — регулярка втратила `\b` через heredoc і
     * мовчки перестала шукати.
     */
    /*
     * Ціль мутації — НЕ `ordering/index.ts`: він саме тим і цінний, що
     * забороненого виклику не робить, тож шукати в ньому означало б
     * вимагати від сторожа знайти те, чого там нема. Беремо файл, у
     * якому виклик є навмисно, — доказ розходження локалей.
     */
    expect(occurrences([PROOF], 'localeCompare').length).toBeGreaterThan(0);
    expect(stripComments('const a = 1; // b.localeCompare(c)')).not.toContain('localeCompare');
    expect(stripComments('sort((a, b) => a.localeCompare(b));')).toContain('localeCompare');
  });
});
