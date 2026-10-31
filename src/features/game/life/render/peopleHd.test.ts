import { describe, expect, it } from 'vitest';
import { lenaLook } from '../look';
import { firstDayOfWeek } from '../sim/calendar';
import { ITEMS } from '../sim/content';
import { newLife } from '../sim/life';
import { rngFor } from '../sim/rng';
import { DIMA, LENA_ADULT, LENA_KID, LENA_TEEN, MOM, OLYA, townsfolkLook } from './people';
import { hasHdSheet, isLenaAdult, isLenaTeen, outfitColors } from './peopleHd';
import { RESIDENT_LOOKS } from './residents';

// Власник 2026-10-31: «повністю відмовляємось від 16×16». Лєна (будь-якого
// тижня, у будь-якому вбранні з шафи), мама й Діма малюються лише аркушами
// PixelLab — і на мапі (`scene.ts`), і в міні-іграх (`Kit.person`).
// 16-піксельні спрайти лишаються мешканцям, перехожим і Олі, доки для них
// нема аркушів (етап 2).
describe('Хто малюється аркушем PixelLab', () => {
  it('Лєна будь-якого тижня в будь-якому вбранні, мама й Діма', () => {
    const outfits = [null, ...ITEMS.filter((i) => i.outfit).map((i) => i.id)];
    expect(outfits.length).toBeGreaterThan(3);
    for (let week = 0; week <= 20; week += 1) {
      for (const outfit of outfits) {
        const look = lenaLook({ ...newLife(7, 'school'), day: firstDayOfWeek(week), outfit });
        expect(hasHdSheet(look), `тиждень ${week}, ${outfit ?? 'своє'}`).toBe(true);
      }
    }
    expect(hasHdSheet(MOM)).toBe(true);
    expect(hasHdSheet(DIMA)).toBe(true);
  });

  it('мешканці, перехожі й Оля — ще 16-піксельні (етап 2)', () => {
    for (const look of [OLYA, ...Object.values(RESIDENT_LOOKS)]) expect(hasHdSheet(look)).toBe(false);
  });

  // Регресія: перехожий з Лєниним волоссям, хвостом, шкірою й очима (з кості
  // — раз на ~1600) малювався аркушем Лєни-підлітка, тобто другою Лєною.
  // Перевіряємо й так, як перехожих беруть міні-ігри: суперник у забігу й
  // друзі на майданчику — той самий вигляд з іншим `kid`.
  it('жоден перехожий не малюється аркушем Лєни, мами чи Діми', () => {
    let doubles = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      for (let k = 0; k < 400; k += 1) {
        const look = townsfolkLook(rngFor(seed, 'перехожі в тесті', k));
        if (look.hair === LENA_TEEN.hair && look.skin === LENA_TEEN.skin && look.eyes === LENA_TEEN.eyes) doubles += 1;
        for (const l of [look, { ...look, kid: true }, { ...look, kid: false }]) expect(hasHdSheet(l), `${seed}/${k}: ${JSON.stringify(l)}`).toBe(false);
      }
    }
    // Схожі волоссям, шкірою й очима трапляються — відрізняє їх зачіска.
    expect(doubles).toBeGreaterThan(20);
  });
});

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

// ADR-0239: одяг з шафи в 32×32 — аркуш перефарбовується лише там, де річ
// відрізняється від намальованої.
describe('Кольори перевдягання', () => {
  it('у намальованому вбранні нічого не фарбує', () => {
    for (const base of [LENA_KID, LENA_TEEN, LENA_ADULT]) expect(outfitColors(base, base)).toEqual({ top: undefined, bottom: undefined, accent: undefined });
  });

  it('вишиванка на підлітку: верх і низ — її, комір і манжети — червона вишивка', () => {
    const look = { ...LENA_TEEN, top: '#f6f1e6', bottom: '#b8323a', accent: '#b8323a' };
    expect(outfitColors(LENA_TEEN, look)).toEqual({ top: '#f6f1e6', bottom: '#b8323a', accent: '#b8323a' });
  });

  it('річ без оздоблення забирає й блакитний комір — він стає кольору верху', () => {
    const { accent: _gone, ...noAccent } = LENA_TEEN;
    const hoodie = { ...noAccent, top: '#c46b8f', bottom: '#3d5a8c' };
    expect(outfitColors(LENA_TEEN, hoodie)).toEqual({ top: '#c46b8f', bottom: '#3d5a8c', accent: '#c46b8f' });
  });

  it('незмінна частина лишається намальованою', () => {
    expect(outfitColors(LENA_ADULT, { ...LENA_ADULT, top: '#f7d36a' })).toEqual({ top: '#f7d36a', bottom: undefined, accent: undefined });
  });
});
