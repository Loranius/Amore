import { describe, expect, it } from 'vitest';
import { DIMA, LENA_ADULT, LENA_KID, LENA_TEEN, MOM, OLYA } from './people';
import { isLenaAdult, isLenaTeen } from './peopleHd';

// ADR-0239, власник 2026-10-06 «Лєна підліток»: аркуш 32×32 малює Лєну
// 7–11 тижня в будь-якому одязі з шафи й нікого іншого.
describe('Лєна-підліток у 32×32', () => {
  it('впізнає Лєну-підлітка і в її одязі, і в купленому', () => {
    expect(isLenaTeen(LENA_TEEN)).toBe(true);
    expect(isLenaTeen({ ...LENA_TEEN, top: '#c2494f', bottom: '#f4f4f7', dress: true })).toBe(true);
  });

  it('не підміняє нею малу й дорослу Лєну, маму, Діму чи Олю', () => {
    for (const look of [LENA_KID, LENA_ADULT, MOM, DIMA, OLYA]) expect(isLenaTeen(look)).toBe(false);
  });

  it('не підміняє нею перехожу з таким самим хвостом, але в шапці чи окулярах', () => {
    expect(isLenaTeen({ ...LENA_TEEN, hat: '#4a7fb5' })).toBe(false);
    expect(isLenaTeen({ ...LENA_TEEN, glasses: true })).toBe(false);
    expect(isLenaTeen({ ...LENA_TEEN, eyes: '#4a90d9' })).toBe(false);
  });
});

// ADR-0239, власник 2026-10-06 «Доросла Лєна»: аркуш дорослої — лише для неї.
describe('Доросла Лєна у 32×32', () => {
  it('впізнає дорослу Лєну і в купленому одязі', () => {
    expect(isLenaAdult(LENA_ADULT)).toBe(true);
    expect(isLenaAdult({ ...LENA_ADULT, top: '#c2494f', dress: false })).toBe(true);
  });

  it('не плутає її з підлітком, малою, мамою, Дімою чи Олею', () => {
    for (const look of [LENA_KID, LENA_TEEN, MOM, DIMA, OLYA]) expect(isLenaAdult(look)).toBe(false);
  });
});

// Власник 2026-10-06: «в Лєни карі очі». Аркуші малюють її такою, якою її
// задано в 16×16, тож і там очі мають лишатися карими.
describe('Очі Лєни', () => {
  it('карі в усіх віках', () => {
    for (const look of [LENA_KID, LENA_TEEN, LENA_ADULT]) expect(look.eyes).toBe('#5a3a26');
  });
});
