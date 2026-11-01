// ============================================================
// Хто є хто: тіло в усіх одне, різняться кольори й обличчя.
// Кольори беруться з `Look` (`people.ts`), тож шкіра, очі й брови Лєни та
// Діми ті самі, що й у решті гри.
// ============================================================
import { DIMA, LENA_ADULT, type Look } from '../people';
import { mix, shade } from '../pixel';
import type { FaceKind } from './faces';

export interface Doll {
  readonly name: string;
  readonly face: FaceKind;
  readonly skin: string;
  readonly eyes: string;
  /** Колір волосся — брови темніші за нього. */
  readonly hair: string;
  readonly lips: string;
}

export function dollOf(name: string, look: Look, face: FaceKind): Doll {
  return { name, face, skin: look.skin, eyes: look.eyes, hair: look.hair, lips: face === 'girl' ? '#d2706f' : shade(look.skin, -0.32) };
}

export const LENA_DOLL = dollOf('lena', LENA_ADULT, 'girl');
export const DIMA_DOLL = dollOf('dima', DIMA, 'boy');
export const DOLLS: readonly Doll[] = [LENA_DOLL, DIMA_DOLL];

/** Ключ сітки → колір. */
export function paletteOf(d: Doll): Readonly<Record<string, string>> {
  const lid = '#2b1d1f';
  const S = shade(d.skin, -0.16);
  const o = mix(shade(d.skin, -0.7), lid, 0.5);
  return {
    h: shade(d.skin, 0.3),
    s: d.skin,
    S,
    // Глибока тінь і внутрішня обвідка — не насиченіші за тінь, а темніші до обвідки.
    D: mix(S, o, 0.28),
    o,
    i: mix(S, o, 0.5),
    p: lid,
    l: lid,
    e: d.eyes,
    E: shade(d.eyes, -0.4),
    w: '#ffffff',
    b: shade(d.hair, -0.35),
    m: d.lips,
    M: d.lips,
    r: '#f09a94',
  };
}

