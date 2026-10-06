import { describe, expect, it } from 'vitest';
import { densityOf, disc, dot, px, rect, setDensity } from './pixel';

/** Контекст, що записує прямокутники. */
function recorder(): { g: CanvasRenderingContext2D; rects: number[][] } {
  const rects: number[][] = [];
  const g = { fillStyle: '', fillRect: (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h]) } as unknown as CanvasRenderingContext2D;
  return { g, rects };
}

describe('щільність пікселів (32×32, власник 2026-10-06)', () => {
  it('за щільності 1 малюнок той самий, що й був: цілі світові пікселі', () => {
    const { g, rects } = recorder();
    expect(densityOf(g)).toBe(1);
    rect(g, 1.3, 2.6, 3.4, 1.2, '#000');
    px(g, 4.4, 5.6, '#000');
    expect(rects).toEqual([[1, 3, 3, 1], [4, 6, 1, 1]]);
  });

  it('за щільності 2 усе вирівнюється до пів світового пікселя, а `dot` — найдрібніша деталь', () => {
    const { g, rects } = recorder();
    setDensity(g, 2);
    rect(g, 1.3, 2.6, 3.4, 1.2, '#000');
    dot(g, 4.4, 5.6, '#000');
    px(g, 4.4, 5.6, '#000');
    expect(rects).toEqual([[1.5, 2.5, 3.5, 1], [4.5, 5.5, 0.5, 0.5], [4.5, 5.5, 1, 1]]);
  });

  it('коло за щільності 2 складається з рядків по пів пікселя — край плавніший', () => {
    const one = recorder();
    disc(one.g, 8, 8, 3, '#000');
    const two = recorder();
    setDensity(two.g, 2);
    disc(two.g, 8, 8, 3, '#000');
    expect(two.rects.length).toBeGreaterThan(one.rects.length);
    expect(two.rects.every(([, , , h]) => h === 0.5)).toBe(true);
  });
});
