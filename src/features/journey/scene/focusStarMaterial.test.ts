import { describe, expect, it } from 'vitest';
import { createFocusStarMaterial, declaredUniforms } from './focusStarMaterial';
import { stellarSignature } from './stellarSurface';

const TURQUOISE = [0.26, 0.85, 0.9] as const;
const GOLD = [0.96, 0.82, 0.35] as const;

describe('createFocusStarMaterial', () => {
  it('віддає колір події таким, яким його дали', () => {
    const material = createFocusStarMaterial({ colour: TURQUOISE, seed: 0.3 });
    expect(material.uniforms.uColour!.value).toEqual([...TURQUOISE]);
  });

  it('дві події НЕ діляться одним масивом кольору', () => {
    /*
     * Заради чого матеріал будується наново на кожен показ.
     *
     * Спільна уніформа означала б, що дві події — одна одиниця стану: колір
     * попередньої встиг би блимнути на наступній під час переходу, і побачити
     * це можна було б лише оком, на переході, який триває півсекунди.
     */
    const first = createFocusStarMaterial({ colour: TURQUOISE, seed: 0.3 });
    const second = createFocusStarMaterial({ colour: GOLD, seed: 0.7 });

    expect(first.uniforms.uColour!.value).not.toBe(second.uniforms.uColour!.value);
    expect(first.uniforms).not.toBe(second.uniforms);

    (second.uniforms.uColour!.value as number[])[0] = 0;
    expect(first.uniforms.uColour!.value).toEqual([...TURQUOISE]);
  });

  it('масив кольору не той самий, що передали — його не можна змінити ззовні', () => {
    const source: [number, number, number] = [0.26, 0.85, 0.9];
    const material = createFocusStarMaterial({ colour: source, seed: 0.1 });
    source[0] = 1;
    expect((material.uniforms.uColour!.value as number[])[0]).toBeCloseTo(0.26, 6);
  });

  it('годинник поверхні починається з нуля й належить лише цьому матеріалу', () => {
    // Спільний годинник означав би, що друга подія відкривається з поверхнею,
    // яка вже півхвилини кипіла, — і перехід читався б як стрибок.
    const first = createFocusStarMaterial({ colour: TURQUOISE, seed: 0.3 });
    const second = createFocusStarMaterial({ colour: GOLD, seed: 0.7 });
    expect(first.uniforms.uTime!.value).toBe(0);
    first.uniforms.uTime!.value = 12;
    expect(second.uniforms.uTime!.value).toBe(0);
  });

  it('насіння входить у зсув візерунка, і різні події мають різні поверхні', () => {
    const first = createFocusStarMaterial({ colour: TURQUOISE, seed: 0.2 });
    const second = createFocusStarMaterial({ colour: TURQUOISE, seed: 0.8 });
    expect(first.uniforms.uSeed!.value).not.toEqual(second.uniforms.uSeed!.value);
    expect(first.uniforms.uSeed!.value).toEqual(stellarSignature(0.2).offset);
    expect(first.uniforms.uSpots!.value).toBeCloseTo(stellarSignature(0.2).spots, 9);
  });

  it('прозорість веде перехід LOD і починається там, де сказано', () => {
    expect(createFocusStarMaterial({ colour: GOLD, seed: 0 }).uniforms.uOpacity!.value).toBe(1);
    expect(
      createFocusStarMaterial({ colour: GOLD, seed: 0, opacity: 0 }).uniforms.uOpacity!.value,
    ).toBe(0);
  });

  it('сонце додається до неба, а не закриває його', () => {
    const material = createFocusStarMaterial({ colour: GOLD, seed: 0 });
    expect(material.transparent).toBe(true);
    expect(material.toneMapped).toBe(false);
  });

  it('пише глибину — інакше шлях малюється поверх диска', () => {
    // Регрес із живого екрана: промінь сузір'я, що проходить ПОЗАДУ події,
    // лягав поверх сонця й читався подряпиною через увесь диск.
    expect(createFocusStarMaterial({ colour: GOLD, seed: 0 }).depthWrite).toBe(true);
  });
});

describe('насіння поверхні', () => {
  it('те саме насіння — та сама поверхня', () => {
    expect(stellarSignature(0.42)).toEqual(stellarSignature(0.42));
  });

  it('зсуви по трьох осях не збігаються між собою', () => {
    // Однакові зсуви поставили б візерунок по діагоналі куба шуму, і всі
    // сонця вийшли б із родинною схожістю.
    const [x, y, z] = stellarSignature(0.37).offset;
    expect(x).not.toBeCloseTo(y, 3);
    expect(y).not.toBeCloseTo(z, 3);
  });

  it('плями є завжди, але ніколи не суцільні', () => {
    // Поверхня без плям виглядає штучно рівною, суцільно плямиста — брудною.
    for (const seed of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(stellarSignature(seed).spots).toBeGreaterThanOrEqual(0.5);
      expect(stellarSignature(seed).spots).toBeLessThanOrEqual(1);
    }
  });
});

describe('шейдер і уніформи не розходяться', () => {
  it('кожна уніформа з коду шейдера справді передається', () => {
    /*
     * Найтихіша можлива вада в шейдері: одруківка в назві уніформи не падає й
     * не попереджає — значення просто не доїжджає, і воно читається нулем.
     * Тут це означало б чорне сонце або сонце без кольору.
     */
    const material = createFocusStarMaterial({ colour: TURQUOISE, seed: 0.5 });
    expect(Object.keys(material.uniforms).sort()).toEqual(declaredUniforms());
  });

  it('жодної зайвої уніформи, яку шейдер не читає', () => {
    const material = createFocusStarMaterial({ colour: TURQUOISE, seed: 0.5 });
    for (const name of Object.keys(material.uniforms)) {
      expect(declaredUniforms()).toContain(name);
    }
  });
});
