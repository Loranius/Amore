import { describe, expect, it } from 'vitest';
import {
  declaredUniforms,
  stellarSignature,
  STELLAR_FRAGMENT,
  STELLAR_VERTEX,
  type StellarDetail,
} from './stellarSurface';

const DETAILS: StellarDetail[] = ['full', 'lite'];

/** Скільки разів шейдер рахує поле шуму. Це і є вся його ціна. */
function noiseFields(source: string): number {
  return [...source.matchAll(/\bfbm\(/g)].length - 1; // мінус саме оголошення
}

function octaves(source: string): number {
  const match = /octave < (\d+)/.exec(source);
  if (!match) throw new Error('у шейдері немає циклу октав');
  return Number(match[1]);
}

describe('обидва профілі — той самий шейдер', () => {
  it('кожен має точку входу й читає ті самі уніформи', () => {
    for (const detail of DETAILS) {
      expect(STELLAR_FRAGMENT[detail]).toContain('void main()');
      for (const name of declaredUniforms()) {
        expect(STELLAR_FRAGMENT[detail] + STELLAR_VERTEX).toContain(name);
      }
    }
  });

  it('вершинний шейдер один на обидва — тіло не змінюється від профілю', () => {
    expect(STELLAR_VERTEX).toContain('vLocal = position');
  });

  it('тексти будуються РАЗ, а не на кожен матеріал', () => {
    /*
     * Рядок шейдера — ключ, за яким three вирішує, чи компілювати програму
     * заново. Новий рядок на кожен показ події означав би нову компіляцію на
     * кожен дотик, тобто рівно той ривок, який ми вже чотири рази виганяли з
     * цієї сцени.
     */
    expect(STELLAR_FRAGMENT.full).toBe(STELLAR_FRAGMENT.full);
    expect(STELLAR_FRAGMENT.lite).not.toBe(STELLAR_FRAGMENT.full);
  });
});

describe('полегшений профіль справді дешевший', () => {
  it('удвічі менше октав', () => {
    expect(octaves(STELLAR_FRAGMENT.full)).toBe(4);
    expect(octaves(STELLAR_FRAGMENT.lite)).toBe(2);
  });

  it('на одне поле шуму менше: плями беруться з уже порахованих зон', () => {
    expect(noiseFields(STELLAR_FRAGMENT.full)).toBe(3);
    expect(noiseFields(STELLAR_FRAGMENT.lite)).toBe(2);
  });

  it('разом це вчетверо менше звернень до хеша на фрагмент', () => {
    // Кожна октава — вісім кутів куба, тобто вісім хешів.
    const cost = (source: string) => noiseFields(source) * octaves(source) * 8;
    expect(cost(STELLAR_FRAGMENT.full)).toBe(96);
    expect(cost(STELLAR_FRAGMENT.lite)).toBe(32);
    expect(cost(STELLAR_FRAGMENT.full) / cost(STELLAR_FRAGMENT.lite)).toBe(3);
  });

  it('візерунок лишається тим самим візерунком, а не іншою поверхнею', () => {
    // Зони, гранули, плями, температура й край — усе на місці в обох.
    for (const detail of DETAILS) {
      for (const part of ['zones', 'grain', 'spot', 'rim', 'hot']) {
        expect(STELLAR_FRAGMENT[detail]).toContain(part);
      }
    }
  });
});

describe('насіння поверхні', () => {
  it('зсув, а не множник: масштаб гранул однаковий у всіх подій', () => {
    // Множник змінював би розмір гранул, тобто одна подія мала б дрібнішу
    // поверхню за іншу без жодної на те причини.
    const small = stellarSignature(0.05);
    const large = stellarSignature(0.95);
    expect(small.offset).not.toEqual(large.offset);
    expect(STELLAR_FRAGMENT.full).toContain('normalize(vLocal) + uSeed');
  });
});
