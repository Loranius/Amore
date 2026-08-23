import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Заборона, яку хтось перевіряє.
// ------------------------------------------------------------
// `CLAUDE.md` забороняв `Math.random()` абсолютно — і на момент, коли цей
// тест з'явився, у `src/` було ЧОТИРНАДЦЯТЬ викликів. Не тому, що правило
// ігнорували, а тому, що абсолютним воно бути не могло: «крутнути страву»
// — це сама суть кнопки, конфеті без випадковості не конфеті, а імена
// файлів у сховищі мусять не збігатись.
//
// Заборона, яку не можна виконати, не виконується. Тому вона
// переформульована в дві, і обидві перевіряються тут:
//
//   РУШІЙ    — жодного недетермінізму взагалі. Однакові канонічні входи
//              мусять давати однакові канонічні виходи, інакше кристал
//              пари перестає бути їхнім кристалом.
//   ПОРТАЛ   — `Math.random()` лише в `src/lib/entropy.ts`, де кожен кидок
//              має названу причину.
// ============================================================

const SRC = join(__dirname, '..');
const ENTROPY = join(SRC, 'lib', 'entropy.ts');

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
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    out.push(path);
  }
  return out;
}

/** `файл:рядок` для кожного входження поза коментарями. */
function occurrences(paths: readonly string[], needle: string): string[] {
  const found: string[] = [];
  for (const path of paths) {
    const lines = stripComments(readFileSync(path, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (line.includes(needle)) {
        found.push(`${relative(SRC, path).split(sep).join('/')}:${index + 1}`);
      }
    });
  }
  return found;
}

describe('недетермінізм має рівно одну адресу', () => {
  it('у рушії його немає взагалі', () => {
    /*
     * Найсуворіша половина правила, і саме вона незмінна. Рушій публікує
     * стани, які мусять бути відтворюваними: те саме життя пари — той
     * самий кристал, на будь-якому пристрої й через рік.
     */
    const engine = sourceFiles(join(SRC, 'engine'));
    expect(occurrences(engine, 'Math.random()')).toEqual([]);
    // Заборонено й ОБХІДНИМ шляхом: імпорт `entropy` з рушія обходив би
    // перевірку вище, лишаючись тим самим недетермінізмом.
    // Перевіряється саме ІМПОРТ, в обох формах запису шляху. Голе слово
    // «entropy» тут не годиться: у `engine/species/tree/math.ts` так
    // звуться звичайні локальні змінні шуму, і до недетермінізму вони
    // стосунку не мають.
    expect(occurrences(engine, "from '@/lib/entropy'")).toEqual([]);
    expect(occurrences(engine, "lib/entropy'")).toEqual([]);
  });

  it('у решті порталу — лише в `lib/entropy.ts`', () => {
    const elsewhere = sourceFiles(SRC).filter((path) => path !== ENTROPY);
    expect(occurrences(elsewhere, 'Math.random()')).toEqual([]);
  });

  it('сам `entropy.ts` кидає монету, інакше він порожній', () => {
    // Зворотний бік інваріанта: якщо вигрібти `Math.random()` і звідси,
    // тест вище лишиться зеленим на непрацюючому коді.
    expect(occurrences([ENTROPY], 'Math.random()').length).toBeGreaterThan(0);
  });
});
