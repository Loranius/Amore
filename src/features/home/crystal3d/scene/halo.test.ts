import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PORTAL_HALO_SEGMENTS,
  buildPortalHaloGeometry,
} from './portalIsland';
import { PORTAL_PALETTES } from './portalScene';

// ============================================================
// Світляне кільце навколо артефакта (ADR-0168).
// ------------------------------------------------------------
// Кільце — єдине в сцені, що стоїть ПОРУЧ З АРТЕФАКТОМ, а не в
// декорації, тож головна вимога до нього не «красиво», а §10: воно не
// має права перегнати кристал. Виміряно на живому кадрі — пік кільця 241
// проти 255 у кристала вдень і 100 проти 255 уночі, — а тут стережеться
// те, що можна перевірити без браузера: будова стрічки й підлога світла.
// ============================================================

const SEED = 20221226;

function halo(): THREE.BufferGeometry {
  return buildPortalHaloGeometry(SEED, PORTAL_HALO_SEGMENTS.high);
}

describe('світляне кільце (ADR-0168)', () => {
  it('будується в одиницях САМОГО кільця, радіусом близько одиниці', () => {
    /*
     * Кільце належить артефактові, а артефакт росте. Тому геометрія
     * лишається одиничною, а розмір ставить той, хто її вішає
     * (`HALO_RADIUS_SHARE` від `frame.artifactHeight`). Прибити тут
     * світові координати означало б кільце, яке підходить парі рівно
     * одного віку.
     */
    const geometry = halo();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    let min = Infinity;
    let max = 0;
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const radius = Math.hypot(position.getX(vertex), position.getZ(vertex));
      min = Math.min(min, radius);
      max = Math.max(max, radius);
    }
    expect(min).toBeGreaterThan(0.85);
    expect(max).toBeLessThan(1.15);
    geometry.dispose();
  });

  it('замикається: між першою й останньою ланкою немає щілини', () => {
    // Розімкнене кільце читається розчерком. Дірка в один сегмент із
    // шістдесяти в кадрі не помітна, а в силуеті — помітна завжди.
    const geometry = halo();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const angles: number[] = [];
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      angles.push(Math.atan2(position.getZ(vertex), position.getX(vertex)));
    }
    angles.sort((a, b) => a - b);
    let widest = angles[0]! + Math.PI * 2 - angles[angles.length - 1]!;
    for (let index = 1; index < angles.length; index += 1) {
      widest = Math.max(widest, angles[index]! - angles[index - 1]!);
    }
    // Ланок шістдесят, тобто крок ≈ 0.105 рад. Подвійний крок — уже щілина.
    expect(widest).toBeLessThan((Math.PI * 2) / PORTAL_HALO_SEGMENTS.high * 2.1);
    geometry.dispose();
  });

  it('має прозорі краї й щільне ядро', () => {
    /*
     * ЦЕ І Є ПРИЧИНА, ЧОМУ РЯДІВ ТРИ, А НЕ ДВА. Стрічка з двох рядів має
     * різані краї: при будь-якій прозорості видно рівно, де вона
     * закінчується, і кільце читається обручем із пластику. Прозорість
     * 0 на краях і повна в ядрі дає край, якого не видно.
     */
    const geometry = halo();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colour = geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(colour.itemSize).toBe(4);
    let innermost = { radius: Infinity, alpha: 1 };
    let outermost = { radius: 0, alpha: 1 };
    let core = 0;
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const radius = Math.hypot(position.getX(vertex), position.getZ(vertex));
      const alpha = colour.getW(vertex);
      if (radius < innermost.radius) innermost = { radius, alpha };
      if (radius > outermost.radius) outermost = { radius, alpha };
      core = Math.max(core, alpha);
    }
    expect(innermost.alpha).toBe(0);
    expect(outermost.alpha).toBe(0);
    expect(core).toBeGreaterThan(0.9);
    geometry.dispose();
  });

  it('гуляє світлом по колу, але ніде не гасне до нуля', () => {
    /*
     * Рівне кільце — це обруч; світло мусить збиратись дугами. Але перша
     * редакція гасила його між дугами майже до нуля, і в кадрі лишалась
     * одна яскрава дуга ліворуч від кристала — випадковий розчерк.
     * Кільце має читатись кільцем ЦІЛКОМ.
     */
    const geometry = halo();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colour = geometry.getAttribute('color') as THREE.BufferAttribute;
    let dimmest = 1;
    let brightest = 0;
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      // Тільки ядро: краї згасають до нуля за побудовою.
      if (colour.getW(vertex) < 0.2) continue;
      const light = colour.getX(vertex);
      dimmest = Math.min(dimmest, light);
      brightest = Math.max(brightest, light);
      // Тон сірий: колір дає матеріал, вершина несе лише силу.
      expect(colour.getY(vertex)).toBeCloseTo(light, 5);
      expect(colour.getZ(vertex)).toBeCloseTo(light, 5);
    }
    expect(dimmest).toBeGreaterThan(0.3);
    expect(brightest).toBeGreaterThan(dimmest * 1.8);
    geometry.dispose();
  });

  it('лишається слабшим за артефакт в обидві пори доби', () => {
    /*
     * §10 у своїй суті: найяскравіше в кадрі — артефакт. Кільце малюється
     * ДОДАВАННЯМ, тож його внесок — це колір, помножений на силу; тут
     * стережеться сама сила, бо саме її рухають, коли кільце «не видно».
     *
     * Виміряно на живому кадрі при цих значеннях: пік кільця 241 проти
     * 255 у кристала вдень і 100 проти 255 уночі. Уночі слабше не з
     * примхи — на темному тлі те саме додавання дає більше.
     */
    expect(PORTAL_PALETTES.light.haloOpacity).toBeLessThan(0.6);
    expect(PORTAL_PALETTES.dark.haloOpacity)
      .toBeLessThan(PORTAL_PALETTES.light.haloOpacity);
  });

  it('порожній профіль якості не малює нічого', () => {
    const empty = buildPortalHaloGeometry(SEED, PORTAL_HALO_SEGMENTS.fallback);
    expect(empty.getAttribute('position').count).toBe(0);
    empty.dispose();
  });
});
