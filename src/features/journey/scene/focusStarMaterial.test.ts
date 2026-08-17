import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { createFocusStarMaterial, declaredUniforms } from './focusStarMaterial';

const TURQUOISE = [0.26, 0.85, 0.9] as const;
const YELLOW = [0.96, 0.82, 0.35] as const;

describe('createFocusStarMaterial', () => {
  it('віддає колір події таким, яким його дали', () => {
    const material = createFocusStarMaterial({ map: null, colour: TURQUOISE });
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
    const first = createFocusStarMaterial({ map: null, colour: TURQUOISE });
    const second = createFocusStarMaterial({ map: null, colour: YELLOW });

    expect(first.uniforms.uColour!.value).not.toBe(second.uniforms.uColour!.value);
    expect(first.uniforms).not.toBe(second.uniforms);

    (second.uniforms.uColour!.value as number[])[0] = 0;
    expect(first.uniforms.uColour!.value).toEqual([...TURQUOISE]);
  });

  it('масив кольору не той самий, що передали — його не можна змінити ззовні', () => {
    const source: [number, number, number] = [0.26, 0.85, 0.9];
    const material = createFocusStarMaterial({ map: null, colour: source });
    source[0] = 1;
    expect((material.uniforms.uColour!.value as number[])[0]).toBeCloseTo(0.26, 6);
  });

  it('без текстури сонце світиться рівно, а не чорніє', () => {
    const material = createFocusStarMaterial({ map: null, colour: TURQUOISE });
    // `uHasMap` = 0 вимикає множення на текстуру; інакше вибірка з порожнього
    // семплера дала б нуль і сонце зникло б, а не «спростилось».
    expect(material.uniforms.uHasMap!.value).toBe(0);
  });

  it('із текстурою вмикає її як джерело яскравості', () => {
    const map = new Texture();
    const material = createFocusStarMaterial({ map, colour: TURQUOISE });
    expect(material.uniforms.uHasMap!.value).toBe(1);
    expect(material.uniforms.uMap!.value).toBe(map);
  });

  it('прозорість веде перехід LOD і починається там, де сказано', () => {
    expect(createFocusStarMaterial({ map: null, colour: YELLOW }).uniforms.uOpacity!.value).toBe(1);
    expect(
      createFocusStarMaterial({ map: null, colour: YELLOW, opacity: 0 }).uniforms.uOpacity!.value,
    ).toBe(0);
  });

  it('сонце додається до неба, а не закриває його', () => {
    const material = createFocusStarMaterial({ map: null, colour: YELLOW });
    expect(material.transparent).toBe(true);
    expect(material.toneMapped).toBe(false);
  });

  it('пише глибину — інакше промінь малюється поверх диска', () => {
    // Регрес із живого екрана: промінь сузір'я, що проходить ПОЗАДУ події,
    // лягав поверх сонця й читався подряпиною через увесь диск.
    expect(createFocusStarMaterial({ map: null, colour: YELLOW }).depthWrite).toBe(true);
  });
});

describe('шейдер і уніформи не розходяться', () => {
  it('кожна уніформа з коду шейдера справді передається', () => {
    /*
     * Найтихіша можлива вада в шейдері: одруківка в назві уніформи не падає й
     * не попереджає — значення просто не доїжджає, і воно читається нулем.
     * Тут це означало б чорне сонце або сонце без кольору.
     */
    const material = createFocusStarMaterial({ map: null, colour: TURQUOISE });
    expect(Object.keys(material.uniforms).sort()).toEqual(declaredUniforms());
  });

  it('жодної зайвої уніформи, яку шейдер не читає', () => {
    const material = createFocusStarMaterial({ map: null, colour: TURQUOISE });
    for (const name of Object.keys(material.uniforms)) {
      expect(declaredUniforms()).toContain(name);
    }
  });
});
