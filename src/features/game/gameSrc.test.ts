import { describe, expect, it } from 'vitest';
import { gameSrc } from './gameSrc';

describe('адреса гри в порталі (ADR-0239)', () => {
  it('змінюється з кожною збіркою, щоб кеш GitHub Pages не показував стару гру', () => {
    expect(gameSrc('/Amore/', '99a65951')).toBe('/Amore/game.html?v=99a65951');
    expect(gameSrc('/Amore/', '99a65951')).not.toBe(gameSrc('/Amore/', '1729f385'));
  });
});
