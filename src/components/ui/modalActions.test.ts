import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Одна смуга дій на всі модалки.
// ------------------------------------------------------------
// **Порахнуто по всіх 26 модалках порталу.** Смуг було вісім різних:
// `.modal-actions` (більшість), `.cal-entry-actions`,
// `.plan-create-actions`, `.shopping-edit-actions`,
// `.wl-archive-gift-actions`, `.mm-map-sheet-actions`,
// `.wl-cloud-sheet-actions`. Разом із ними розходились кнопки:
// скасування писали трьома словниками (`.btn-ghost`, `.btn-secondary`,
// власні `-cancel`), головну дію — двома (`.btn`, `.btn-primary`).
//
// **`.btn-primary` при цьому не мав ЖОДНОГО правила в CSS.** Два місця
// носили клас, який нічого не стилізує, тобто це були неоформлені
// браузерні кнопки.
//
// Наслідок бачила пара, а не розробник: у кожній модалці «зберегти»
// опинялась іншого розміру й в іншому місці, і щоразу її доводилось
// шукати заново.
// ============================================================

const FEATURES = join(__dirname, '..', '..', 'features');

/**
 * Композер спогаду — названий виняток.
 *
 * Його «Готово» стоїть УГОРІ праворуч, бо це повноекранний блокнот, і
 * саме так стоїть телефонний блокнот. Це конвенція платформи, яку пара
 * уже знає, а не розбіжність порталу.
 */
const TOP_BAR_EXCEPTIONS = ['memories/MomentComposer.tsx'];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) { out.push(...sourceFiles(path)); continue; }
    if (/\.tsx$/.test(entry) && !/\.test\./.test(entry)) out.push(path);
  }
  return out;
}

const rel = (path: string) => relative(FEATURES, path).split(sep).join('/');

describe('смуга дій модалки', () => {
  it('`.btn-primary` не повертається: такого правила в CSS немає', () => {
    /*
     * Клас-привид найгірший саме тим, що виглядає навмисним. Кнопка з
     * ним не має ні кольору, ні розміру, ні тіла — і саме тому її ніхто
     * не помічав як ваду.
     */
    const offenders: string[] = [];
    for (const path of sourceFiles(FEATURES)) {
      if (/btn-primary/.test(stripComments(readFileSync(path, 'utf8')))) {
        offenders.push(rel(path));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('модалки не заводять власних смуг дій', () => {
    const dead = [
      'cal-entry-actions"',
      'plan-create-actions"',
      'shopping-edit-actions',
      'wl-archive-gift-actions"',
      'mm-map-sheet-actions"',
    ];
    const offenders: string[] = [];
    for (const path of sourceFiles(FEATURES)) {
      const source = stripComments(readFileSync(path, 'utf8'));
      for (const name of dead) {
        // Модифікатор поруч із каноном дозволений; самостійна смуга — ні.
        const standalone = new RegExp(`className="${name.replace('"', '')}"`);
        if (standalone.test(source)) offenders.push(`${rel(path)}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('канон задає розмір кнопок, а не кожна модалка окремо', () => {
    const index = readFileSync(join(FEATURES, '..', 'index.css'), 'utf8');
    const rule = index.slice(index.indexOf('.modal-actions .btn,'));
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/min-height:\s*48px/);
  });

  it('виняток із верхньою смугою названий, а не забутий', () => {
    // Якщо композер колись переїде на канон — цей тест має впасти, щоб
    // виняток прибрали свідомо, а не лишили висіти в списку.
    for (const name of TOP_BAR_EXCEPTIONS) {
      const source = stripComments(readFileSync(join(FEATURES, name), 'utf8'));
      expect(source).toMatch(/className="mm-save"/);
      expect(source).not.toMatch(/className="modal-actions"/);
    }
  });
});
