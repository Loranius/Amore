import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Кути беруться зі шкали, а не з голови.
// ------------------------------------------------------------
// **Порахнуто по всіх 83 файлах стилю.** Шкала радіусів існувала
// токенами (`--radius-sm/md/lg/xl/pill`), і її ігнорували: з 312
// оголошень `border-radius` токенами користувались 62. Решта 250
// розсипались континуумом — у порталі зустрічались 2, 3, 4, 5, 6, 7, 8,
// 9, 11, 12, 13, 15, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29, 30, 34,
// 36 і 38 пікселів, тобто майже кожне ціле число підряд.
//
// Жоден окремий випадок не помітний: 18 замість 16 не бачить ніхто.
// Помітна СУМА — коли на одному екрані сходяться картка на 18, поле на
// 15 і кнопка на 13, поверхні перестають виглядати вирізаними з одного
// матеріалу.
//
// Три щаблі дописано під те, що вже існувало в коді, а не заради
// симетрії: `hair` (4px) для кутів полароїда й крапок календаря, `card`
// (16px) — `DESIGN.md` називав цей радіус, але токена не було, і `dock`
// (32px) для дока й екрана входу, які мусять збігатись.
// ============================================================

const SRC = join(__dirname, '..', '..');

/** Дозволені сирі пікселі: лише визначення самих токенів. */
const TOKEN_DEFINITION = /^\s*--radius-[a-z]+:\s*\d+px;/;

function cssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) { out.push(...cssFiles(path)); continue; }
    if (entry.endsWith('.css')) out.push(path);
  }
  return out;
}

describe('шкала радіусів', () => {
  it('жоден радіус не задається сирими пікселями', () => {
    const offenders: string[] = [];
    for (const path of cssFiles(SRC)) {
      const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      source.split('\n').forEach((line, index) => {
        if (TOKEN_DEFINITION.test(line)) return;
        const match = /border-radius:\s*([^;]+);/.exec(line);
        if (!match) return;
        const value = match[1]!;
        // Запасне значення всередині `var(--radius-pill, 999px)` — це той
        // самий токен, а не обхід шкали.
        const bare = value.replace(/var\(--radius-[a-z]+(,\s*[^)]*)?\)/g, '');
        if (/\d+px/.test(bare)) {
          offenders.push(`${relative(SRC, path).split(sep).join('/')}:${index + 1}  ${value.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('шкала має рівно вісім щаблів', () => {
    /*
     * Число тут не священне — священна СКІНЧЕННІСТЬ. Дев'ятий щабель
     * означає, що комусь забракло восьми, і саме так шкала й
     * розсипається назад у континуум: спершу «ну тут треба 18», потім
     * 19, потім усе підряд.
     */
    const index = readFileSync(join(SRC, 'index.css'), 'utf8');
    const steps = index.match(/--radius-[a-z]+:\s*\d+px;/g) ?? [];
    expect(steps).toHaveLength(8);
  });

  it('щаблі йдуть від дрібного до пігулки без повторів', () => {
    const index = readFileSync(join(SRC, 'index.css'), 'utf8');
    const values = [...index.matchAll(/--radius-[a-z]+:\s*(\d+)px;/g)].map((m) => Number(m[1]));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });
});
