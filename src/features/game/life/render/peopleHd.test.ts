import { describe, expect, it } from 'vitest';
import { lenaLook } from '../look';
import { firstDayOfWeek } from '../sim/calendar';
import { ITEMS } from '../sim/content';
import { newLife } from '../sim/life';
import { rngFor } from '../sim/rng';
import { DIMA, LENA_ADULT, LENA_KID, LENA_TEEN, MOM, OLYA, townsfolkLook } from './people';
import { FOLK, folkSheetName, hasHdSheet, hdCell, isLenaAdult, isLenaTeen, outfitColors, PORT_CELL } from './peopleHd';
import { RESIDENT_LOOKS } from './residents';

// Власник 2026-10-31: «повністю відмовляємось від 16×16». Лєна (будь-якого
// тижня, у будь-якому вбранні з шафи), мама, Діма й Оля («Починай з Олі»)
// малюються лише аркушами PixelLab — на мапі (`scene.ts`), у міні-іграх
// (`Kit.person`) і в портретах (`Portrait`). Мешканці й перехожі (етап 2,
// власник 2026-11-03: «Публікуй персонажів в гру») — людьми Godot-порту.
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

  // Оля на мапі й у діалогах — `{ ...OLYA, kid: тиждень ≤ 6 }` (`controller.ts`,
  // `LifeGame.tsx`); дорослою вона в грі не з'являється.
  it('Оля: мала — своїм аркушем, підліток — своїм, і жоден не чужий', () => {
    const kid = { ...OLYA, kid: true };
    const teen = { ...OLYA, kid: false };
    expect(hasHdSheet(kid)).toBe(true);
    expect(hasHdSheet(teen)).toBe(true);
    expect(hdCell(kid)).toBe(PORT_CELL);
    expect(hdCell(teen)).toBe(PORT_CELL);
    for (const look of [kid, teen]) {
      expect(isLenaTeen(look)).toBe(false);
      expect(isLenaAdult(look)).toBe(false);
    }
  });

  it('мешканці — людьми порту, сиві — бабусею й сивим чоловіком', () => {
    for (const look of Object.values(RESIDENT_LOOKS)) {
      expect(hasHdSheet(look), JSON.stringify(look)).toBe(true);
      expect(folkSheetName(look), JSON.stringify(look)).not.toBeNull();
    }
    expect(folkSheetName(RESIDENT_LOOKS.hanna!)).toBe('woman-granny');
  });

  it('аркуш перехожого — за виглядом: діти дитячим, чоловіки чоловічим, та сама зачіска, сиві — сивими, той самий щоразу', () => {
    const kinds = new Set<string>();
    for (let k = 0; k < 2000; k += 1) {
      const look = townsfolkLook(rngFor(3, 'перехожі в тесті', k));
      const name = folkSheetName(look)!;
      expect(folkSheetName({ ...look })).toBe(name);
      const male = look.hairStyle === 'short' || look.hairStyle === 'spiky';
      expect(FOLK[name]!.kind, JSON.stringify(look)).toBe(look.kid ? (male ? 'boy' : 'girl') : male ? 'man' : 'woman');
      const grey = !look.kid && (look.hair === '#8a8a8a' || look.hair === '#c8c4bc');
      if (grey) expect(name).toBe(male ? 'man-grey' : 'woman-granny');
      else expect(['man-grey', 'woman-granny']).not.toContain(name);
      const kind = FOLK[name]!.kind;
      const hairs = Object.entries(FOLK).filter(([n, f]) => f.kind === kind && n !== 'man-grey' && n !== 'woman-granny').map(([, f]) => f.hair);
      if (!grey && hairs.includes(look.hairStyle)) expect(FOLK[name]!.hair, JSON.stringify(look)).toBe(look.hairStyle);
      kinds.add(name);
    }
    // Кожен аркуш хтось та й носить.
    expect([...kinds].sort()).toEqual(Object.keys(FOLK).sort());
  });

  // Регресія: перехожий з Лєниним волоссям, хвостом, шкірою й очима (з кості
  // — раз на ~1600) малювався аркушем Лєни-підлітка, тобто другою Лєною.
  // Перевіряємо й так, як перехожих беруть міні-ігри: суперник у забігу й
  // друзі на майданчику — той самий вигляд з іншим `kid`.
  it('жоден перехожий не малюється аркушем Лєни, мами, Діми чи Олі', () => {
    let doubles = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      for (let k = 0; k < 400; k += 1) {
        const look = townsfolkLook(rngFor(seed, 'перехожі в тесті', k));
        if (look.hair === LENA_TEEN.hair && look.skin === LENA_TEEN.skin && look.eyes === LENA_TEEN.eyes) doubles += 1;
        for (const l of [look, { ...look, kid: true }, { ...look, kid: false }]) expect(folkSheetName(l), `${seed}/${k}: ${JSON.stringify(l)}`).not.toBeNull();
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

  it('у підлітка порту оздоблення нема — річ без оздоблення його й не додає', () => {
    const hoodie = { ...LENA_TEEN, top: '#c46b8f', bottom: '#3d5a8c' };
    expect(outfitColors(LENA_TEEN, hoodie)).toEqual({ top: '#c46b8f', bottom: '#3d5a8c', accent: undefined });
  });

  it('незмінна частина лишається намальованою', () => {
    expect(outfitColors(LENA_ADULT, { ...LENA_ADULT, top: '#f7d36a' })).toEqual({ top: '#f7d36a', bottom: undefined, accent: undefined });
  });
});
