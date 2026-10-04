import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAME_MAX_DPR } from '@/features/game/life/controller';

// ============================================================
// Власник, 2026-10-04: «оптимізуй роботу сайту під айфони». Засувки на три
// речі, які в iOS Safari коштують дорого або ламаються, а в пісочниці
// (Chromium) їх не видно:
//   * `background-attachment: fixed` — iOS його не підтримує, а Chrome через
//     нього перемальовує фон щокадру прокрутки;
//   * поле з font-size < 16px — iOS зумить сторінку при фокусі;
//   * полотно гри зі щільністю 3 — дев'ять пікселів на точку щокадру.
// ============================================================

const SRC = fileURLToPath(new URL('..', import.meta.url));

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('iOS Safari', () => {
  it('жодного `background-attachment: fixed` у стилях порталу', () => {
    const offenders = cssFiles(SRC).filter((f) => /background-attachment\s*:\s*fixed/.test(stripComments(readFileSync(f, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('поля на iOS — не дрібніші за 16px, хай що кажуть модульні стилі', () => {
    const css = stripComments(readFileSync(join(SRC, 'index.css'), 'utf8'));
    const block = css.match(/@supports \(-webkit-touch-callout: none\) \{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    const body = block![1]!;
    for (const tag of ['input', 'select', 'textarea']) expect(body).toContain(tag);
    expect(body).toMatch(/font-size:\s*max\(16px,\s*1em\)\s*!important/);
  });

  it('полотно гри не рендерить щільніше за 2', () => {
    expect(GAME_MAX_DPR).toBeLessThanOrEqual(2);
  });
});
