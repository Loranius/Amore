// ============================================================
// Хто є хто: тіло в усіх одне, різняться кольори й обличчя.
// Кольори беруться з `Look` (`people.ts`), тож шкіра, очі й брови Лєни та
// Діми ті самі, що й у решті гри.
// ============================================================
import { DIMA, LENA_ADULT, type Look } from '../people';
import { mix } from '../pixel';
import type { FaceKind } from './faces';
import type { HairName } from './hair';
import type { DollShape } from './rig';

export interface Doll extends DollShape {
  readonly name: string;
  readonly skin: string;
  readonly eyes: string;
  /** Колір волосся — брови темніші за нього. */
  readonly hair: string;
  readonly lips: string;
}

function dollOf(name: string, look: Look, face: FaceKind, hairStyle: HairName): Doll {
  return { name, face, hairStyle, skin: look.skin, eyes: look.eyes, hair: look.hair, lips: face === 'girl' ? '#d2706f' : mix(look.skin, '#5c2e2e', 0.5) };
}

export const LENA_DOLL = dollOf('lena', LENA_ADULT, 'girl', 'long');
export const DIMA_DOLL = dollOf('dima', DIMA, 'boy', 'short');
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
    a: mix(d.hair, '#ffe2b0', 0.35),
    A: d.hair,
    q: mix(d.hair, '#5a2416', 0.32),
    Q: mix(d.hair, '#5a2416', 0.55),
    O: mix(d.hair, '#24110f', 0.72),
    I: mix(d.hair, '#24110f', 0.45),
    c: '#f2c94c',
    C: '#c98f2e',
  };
}
