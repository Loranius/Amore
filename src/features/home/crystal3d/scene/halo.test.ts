import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PORTAL_HALO_SEGMENTS,
  buildPortalHaloGeometry,
} from './portalIsland';
import { PORTAL_PALETTES } from './portalScene';
import { portalGlowBillboard } from './portalGlowBillboard';

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

/**
 * Чи це вершина САМОГО КІЛЬЦЯ, а не диска світіння.
 *
 * У меші живуть два різні тіла з одним матеріалом (ADR-0170): кільце
 * стоїть там, де стоїть, а диски — це білборди, чиї вершини лежать усі в
 * одній точці на осі й розсуваються вершинним шейдером. Кожна мірка
 * кільця мусить питати саме кільце, інакше вона міряє суміш: перша
 * редакція цих тестів після додавання дисків почала бачити радіус 0 і
 * «непрозорий внутрішній край».
 *
 * Межа береться з ОПУБЛІКОВАНОГО розкладу, а не з атрибута зсуву:
 * центральна вершина диска теж має нульовий зсув — вона й є центр, — тож
 * за атрибутом два тіла не розрізнити. Друга редакція цього помічника
 * спіткнулась саме на цьому.
 */
function isRing(geometry: THREE.BufferGeometry, vertex: number): boolean {
  const layout = geometry.userData.haloLayout as { ring: number; glow: number } | undefined;
  expect(layout, 'меш кільця не опублікував свій розклад').toBeDefined();
  return vertex < layout!.ring * 3;
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
      if (!isRing(geometry, vertex)) continue;
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
      if (!isRing(geometry, vertex)) continue;
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
      if (!isRing(geometry, vertex)) continue;
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
      if (!isRing(geometry, vertex)) continue;
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

  it('світиться навколо артефакта БІЛБОРДАМИ, а не пласкими наліпками', () => {
    /*
     * Це «bloom для бідних» (ADR-0170): повноекранний прохід заборонений,
     * доки не поставлено діагноз білому фону на пристрої власника, а
     * диск із м'яким краєм від того діагнозу не залежить узагалі.
     *
     * Три речі мусять бути правдою, і кожна вже була неправдою:
     *
     *  1. Усі вершини дисків стоять НА ОСІ артефакта. Розсуває їх
     *     вершинний шейдер, тож у геометрії вони — одна точка; якби вони
     *     стояли в світі, поворот острова рукою показав би ребро.
     *  2. Зсуви ненульові — інакше диск лишиться точкою.
     *  3. Максимум прозорості лежить НЕ В ЦЕНТРІ. Центр диска лежить
     *     усередині тіла кристала, і ближня половина кристала його
     *     закриває; максимум, посаджений у центр, витрачається на
     *     невидиме. Перенесення його на середнє кільце підняло виміряний
     *     внесок у кадр із 25.3 до 45.8 з 441 при тій самій енергії.
     */
    const geometry = halo();
    const layout = geometry.userData.haloLayout as { ring: number; glow: number };
    expect(layout.glow).toBeGreaterThan(0);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const glow = geometry.getAttribute('portalGlow') as THREE.BufferAttribute;
    const colour = geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(glow).toBeDefined();

    let spread = 0;
    let centre = 0;
    let middle = 0;
    for (let vertex = layout.ring * 3; vertex < position.count; vertex += 1) {
      expect(Math.hypot(position.getX(vertex), position.getZ(vertex)), 'диск зійшов з осі')
        .toBeLessThan(1e-6);
      const offset = Math.hypot(glow.getX(vertex), glow.getY(vertex));
      spread = Math.max(spread, offset);
      if (offset < 1e-6) centre = Math.max(centre, colour.getW(vertex));
      else if (offset < 0.5) middle = Math.max(middle, colour.getW(vertex));
    }
    expect(spread).toBeGreaterThan(0.1);
    expect(middle).toBeGreaterThan(centre);
    geometry.dispose();
  });

  it('зсуває вершину В ПЛОЩИНІ КАМЕРИ, а не по світових осях', () => {
    /*
     * Перевіряється сам укол у шейдер. Дві речі, які легко втратити при
     * рефакторингу й неможливо побачити в жодному тесті геометрії:
     * зсув мусить іти по ОСЯХ КАМЕРИ (стовпці `modelViewMatrix`) і
     * мусить лягати на `transformed`, тобто ДО множення на цю саму
     * матрицю — інакше масштаб групи подіє на нього двічі.
     */
    const shader = { vertexShader: 'void main() {\n#include <begin_vertex>\n}' };
    portalGlowBillboard(shader);
    expect(shader.vertexShader).toContain('attribute vec2 portalGlow;');
    expect(shader.vertexShader).toContain('modelViewMatrix[0][0]');
    expect(shader.vertexShader).toContain('normalize');
    expect(shader.vertexShader).toContain('transformed += portalRight');
    expect(shader.vertexShader.indexOf('#include <begin_vertex>'))
      .toBeLessThan(shader.vertexShader.indexOf('transformed += portalRight'));
  });

  it('порожній профіль якості не малює нічого', () => {
    const empty = buildPortalHaloGeometry(SEED, PORTAL_HALO_SEGMENTS.fallback);
    expect(empty.getAttribute('position').count).toBe(0);
    empty.dispose();
  });
});
