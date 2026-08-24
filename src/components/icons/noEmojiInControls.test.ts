import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Емодзі не керують інтерфейсом.
// ------------------------------------------------------------
// Причина записана ще в `TabBar`, повторена в ADR-0050 і остаточно
// доведена шрифтовою роботою (ADR-0052): емодзі малює СИСТЕМА, а не
// портал. Наслідки виміряні, а не уявні:
//
//  - емодзі не бере `currentColor`, тож у покупках значок категорії й
//    її кольорова пляма поруч розповідали різне;
//  - він не масштабується разом із текстом і не має ваги;
//  - на кожній платформі виглядає інакше — рівно та неоднорідність, від
//    якої портал пішов, коли звівся до одного шрифта.
//
// **Але це не заборона емодзі.** Портал розмовляє з парою, і в цій мові
// «Привіт, пупс 🌸» — не оформлення, а інтонація. Тому нижче названий
// список місць, де емодзі лишається навмисно; усе решта — значки.
// ============================================================

const SRC = join(__dirname, '..', '..');

/**
 * Де емодзі лишається — і чому саме там.
 *
 * Спільне в усіх трьох: це портал ЗВЕРТАЄТЬСЯ до пари, а не позначає
 * керування. Такий рядок не має стану, його не можна натиснути, і
 * системний вигляд емодзі тут не шкодить — він і має бути «як у
 * повідомленні», а не «як у застосунку».
 */
const VOICE = new Set([
  // Привітання на головній: «Хай, бубос 💛», «Привіт, Лєнусік 💕».
  'features/home/Hero.tsx',
  // «Хто сьогодні заходить у портал? 💗» і «Портал відкрито, Діма 💗».
  'features/auth/LoginPage.tsx',
  // «🎉 Сьогодні 1 рік разом!» — рівно один день на рік. Щоденна
  // плашка «Річниця через N дн.» емодзі НЕ має, і це не недогляд:
  // те, що на екрані щодня, — це вже інтерфейс.
  'features/home/homeUtils.ts',
]);

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const rel = (path: string) => relative(SRC, path).split(sep).join('/');

describe('емодзі не керують інтерфейсом', () => {
  it('поза названим списком голосу емодзі в коді немає', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const name = rel(file);
      if (VOICE.has(name)) continue;
      // Консоль розробника — не інтерфейс пари.
      if (name === 'lib/realtime.ts') continue;
      for (const line of stripComments(readFileSync(file, 'utf8')).split('\n')) {
        const found = line.match(EMOJI);
        if (found) offenders.push(`${name}: ${found[0]} — ${line.trim().slice(0, 60)}`);
      }
    }
    expect(offenders, 'ці місця мусять узяти мальований значок').toEqual([]);
  });

  it('список голосу не порожній — це виняток, а не забуте правило', () => {
    /*
     * Якби список став порожнім, правило перетворилось би на «емодзі
     * заборонені», а це вже інша річ і її треба вирішувати свідомо:
     * привітання без 🌸 — інший продукт, не інша верстка.
     */
    expect(VOICE.size).toBeGreaterThan(0);
    for (const name of VOICE) {
      const source = readFileSync(join(SRC, name), 'utf8');
      expect(EMOJI.test(stripComments(source)), `${name} більше не має емодзі`).toBe(true);
    }
  });
});
