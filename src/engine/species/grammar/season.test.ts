import { describe, expect, it } from 'vitest';
import { seasonOf } from './season';

// ADR-0237 §7, п. 4: пора року — з дати знімка, український календар.
describe('пора року з дати знімка', () => {
  it('зима — грудень…лютий, весна — березень…травень, літо — червень…серпень, осінь — вересень…листопад', () => {
    const months = Array.from({ length: 12 }, (_, i) => seasonOf(`2026-${String(i + 1).padStart(2, '0')}-15`));
    expect(months).toEqual([
      'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
      'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
    ]);
  });
});
