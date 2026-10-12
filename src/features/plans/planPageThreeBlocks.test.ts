// ============================================================
// Сторінка плану — три блоки на одній нитці (ADR-0256).
// ============================================================
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(join(__dirname, 'PlanDetailsPage.tsx'), 'utf8');
const css = readFileSync(join(__dirname, 'plansMap.css'), 'utf8');

describe('сторінка плану легша', () => {
  it('блоків три: Коли, Підготовка (або Спогади), Пов’язане', () => {
    const blocks = [...page.matchAll(/data-map-block="([a-z]+)"/g)].map((m) => m[1]);
    expect(new Set(blocks)).toEqual(new Set(['when', 'tasks']));
    expect(page).toContain('id="tasks"');
    expect(page).toContain('id="links"');
    expect(page).not.toContain('id="status"');
    expect(page).not.toContain('id="money"');
  });

  it('нитка одна: Коли → Підготовка → Пов’язане', () => {
    expect(page).toMatch(/\['when', 'tasks'\], \['tasks', 'links'\]/);
  });

  it('у «Коли» одна дія за станом', () => {
    expect(page).toMatch(/stage === 'idea' && \([\s\S]*?Дати дату/);
    expect(page).toMatch(/stage === 'scheduled' && \([\s\S]*?Прожили/);
  });

  it('назва — заголовок сторінки, а не блок; бюджет — рядок підготовки', () => {
    expect(page).toContain('className="pmap-head-page"');
    expect(page).toContain('className="pmap-budget"');
  });

  it('блоки не світяться й не плавають', () => {
    expect(css).not.toContain('pmap-float');
    expect(css).not.toContain('pmap-rim');
    expect(css).not.toContain('--pmap-halo');
  });
});
