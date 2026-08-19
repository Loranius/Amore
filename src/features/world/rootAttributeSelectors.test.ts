import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Атрибути кореня комбінуються, а не вкладаються.
// ------------------------------------------------------------
// `data-theme`, `data-world-scene`, `data-world-quality`, `data-immersive`
// і `data-portal-scene` ставляться на ОДИН елемент —
// `document.documentElement`. Тож селектор із пробілом між двома з них
// («нащадок») не може збігтись ніколи: елемента, вкладеного в `<html>` і
// водночас із другим атрибутом кореня, не існує.
//
// Це не теорія. Правило світлої теми в `worldDim.css` було написане саме
// так, і не спрацювало жодного разу. Помилки CSS при цьому не дає —
// просто мовчить, — і на живому екрані це виглядало як «світла тема
// чомусь із сірим фоном»: заголовок «Найближчі плани» опинився на сірому
// й давав близько 1.5:1 замість розрахованих 6.6.
//
// Дешевше тримати це тут, ніж ловити знімком щоразу.
// ============================================================

const ROOT = join(__dirname, '../../..');

/** Атрибути, які портал ставить саме на `<html>`. */
const ROOT_ATTRS = [
  'data-theme',
  'data-world-scene',
  'data-world-quality',
  'data-immersive',
  'data-portal-scene',
];

const attr = ROOT_ATTRS.join('|');
/** `[data-theme='light'] [data-world-scene='dim']` — пробіл між двома кореневими. */
const DESCENDANT = new RegExp(`\\[(?:${attr})=[^\\]]+\\]\\s+\\[(?:${attr})=`);

describe('селектори кореневих атрибутів', () => {
  it('жоден не чекає кореневий атрибут на нащадку', () => {
    const offenders: string[] = [];
    for (const file of globSync('src/**/*.css', { cwd: ROOT })) {
      const css = readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [index, line] of css.split('\n').entries()) {
        if (DESCENDANT.test(line)) offenders.push(`${file}:${index + 1}  ${line.trim()}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
