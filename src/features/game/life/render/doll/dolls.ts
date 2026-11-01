// ============================================================
// Хто є хто: тіло в усіх одне, різняться кольори й обличчя.
// Кольори беруться з `Look` (`people.ts`), тож шкіра, очі й брови Лєни та
// Діми ті самі, що й у решті гри.
// ============================================================
import { DIMA, LENA_ADULT, type Look } from '../people';
import { mix } from '../pixel';
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
  return { name, face, skin: look.skin, eyes: look.eyes, hair: look.hair, lips: face === 'girl' ? '#d2706f' : mix(look.skin, '#5c2e2e', 0.5) };
}

export const LENA_DOLL = dollOf('lena', LENA_ADULT, 'girl');
export const DIMA_DOLL = dollOf('dima', DIMA, 'boy');
export const DOLLS: readonly Doll[] = [LENA_DOLL, DIMA_DOLL];

/** Ключ сітки → колір. Обвідка м'яка, червонувато-коричнева, а не майже чорна (за референсами власника). */
export function paletteOf(d: Doll): Readonly<Record<string, string>> {
  const dark = '#5c2e2e';
  const lid = '#2f1d22';
  return {
    h: mix(d.skin, '#ffffff', 0.35),
    s: d.skin,
    S: mix(d.skin, '#d9826e', 0.32),
    D: mix(d.skin, dark, 0.3),
    o: mix(d.skin, dark, 0.72),
    i: mix(d.skin, dark, 0.45),
    p: lid,
    E: mix(d.eyes, '#1a1014', 0.45),
    e: d.eyes,
    L: mix(d.eyes, '#ffffff', 0.35),
    w: '#ffffff',
    b: mix(d.hair, lid, 0.35),
    m: d.lips,
    M: d.lips,
    r: '#f2a0a0',
  };
}
