import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PORTAL_DRIFT_ROCKS,
  PORTAL_ISLAND_RADIUS,
  PORTAL_ISLAND_RUBBLE,
  buildPortalCloudGeometry,
  buildPortalDriftGeometry,
  buildPortalIslandGeometry,
  buildPortalTempleGeometry,
  PORTAL_CLOUD_BANKS,
} from './portalIsland';
import {
  PORTAL_DRIFT_LIFT,
  PORTAL_DRIFT_OFFSET_GLSL,
  PORTAL_DRIFT_PERIOD,
  portalDriftLift,
} from './portalLevitation';

// ============================================================
// Левітація малих островів (ADR-0162).
// ------------------------------------------------------------
// Прохання власника: «додай легеньку левітацію на маленькі острови навколо
// основного острова, вони повільно піднімаються вверх і вниз не на велику
// дистанцію, основний острів не рухається».
//
// Три вимоги, три половини яких перевіряються тут, а четверту — «повільно» —
// тримає число періоду. Найважливіша з них ОСТАННЯ: «основний острів не
// рухається» мусить бути властивістю будови, а не домовленості. Меш, який
// не несе атрибута руху, зрушити нічим; меш, якому передали нуль, зрушить
// того дня, коли хтось передасть не нуль.
// ============================================================

const SEED = 20221226;

function attribute(geometry: { getAttribute(name: string): unknown }): unknown {
  return geometry.getAttribute('portalFloat');
}

describe('левітація малих островів', () => {
  it('несуть атрибут руху тільки брили в небі', () => {
    // Це і є «основний острів не рухається»: не нуль в уніформі, а
    // відсутність самої можливості.
    expect(attribute(buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high))).toBeDefined();
    expect(attribute(buildPortalIslandGeometry(SEED, PORTAL_ISLAND_RUBBLE.high))).toBeUndefined();
    expect(attribute(buildPortalTempleGeometry(SEED))).toBeUndefined();
    expect(attribute(buildPortalCloudGeometry(SEED, PORTAL_CLOUD_BANKS.high))).toBeUndefined();
  });

  it('дає кожній брилі СВОЮ фазу, а не спільну', () => {
    /*
     * Спільна фаза — це не летючі камені, а один камінь, розмножений
     * копіюванням: усі підіймаються разом, і око читає це як тремтіння
     * камери.
     */
    const drift = buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high);
    const floats = Array.from(
      (drift.getAttribute('portalFloat') as { array: ArrayLike<number> }).array,
    );
    const phases = new Set<number>();
    const paces = new Set<number>();
    for (let at = 0; at + 1 < floats.length; at += 2) {
      phases.add(Math.round(floats[at]! * 1e4));
      paces.add(Math.round(floats[at + 1]! * 1e4));
    }
    expect(phases.size).toBe(PORTAL_DRIFT_ROCKS.high);
    expect(paces.size).toBe(PORTAL_DRIFT_ROCKS.high);
  });

  it('тримає одну фазу на всі вершини однієї брили', () => {
    // Інакше камінь не піднявся б, а розтягнувся: вершини одного тіла
    // поїхали б у різні боки.
    const drift = buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high);
    const floats = (drift.getAttribute('portalFloat') as { array: ArrayLike<number> }).array;
    const vertices = floats.length / 2;
    const perRock = vertices / PORTAL_DRIFT_ROCKS.high;
    expect(Number.isInteger(perRock)).toBe(true);
    for (let rock = 0; rock < PORTAL_DRIFT_ROCKS.high; rock += 1) {
      const first = floats[rock * perRock * 2];
      for (let vertex = 0; vertex < perRock; vertex += 1) {
        expect(floats[(rock * perRock + vertex) * 2], `брила ${rock}`).toBe(first);
      }
    }
  });

  it('НЕ НА ВЕЛИКУ ДИСТАНЦІЮ, і межа названа числом', () => {
    /*
     * «Легенька» власника — це 0.038 радіуса острова. На телефоні, де
     * острів займає близько 250 CSS-пікселів, це ±9.5 пікселя: видно, що
     * камінь дихає, і не видно, що він кудись летить.
     *
     * Стеля 0.08 — не рівність: розмах вільний у своїй смузі. Але вище
     * десятої частини острова камінь перестає висіти й починає їздити, а
     * брила, що їздить, — це вже не «літаючий острів», а ліфт.
     */
    expect(PORTAL_DRIFT_LIFT).toBeLessThan(PORTAL_ISLAND_RADIUS * 0.08);
    expect(PORTAL_DRIFT_LIFT).toBeGreaterThan(0);
  });

  it('ПОВІЛЬНО: найшвидша брила все одно повільніша за десять секунд на цикл', () => {
    // Темп 0.72…1.34 при періоді 17 с дає 12.7…23.6 секунди на брилу.
    const paces = [0.72, 1.34];
    for (const pace of paces) {
      expect(PORTAL_DRIFT_PERIOD / pace).toBeGreaterThan(10);
    }
  });

  it('повертається туди, звідки почала', () => {
    // Синус, а не дрейф: камінь, який за годину піднявся б на радіус
    // острова, — це не левітація, а витік.
    for (const [phase, pace] of [[0, 1], [1.7, 0.72], [4.4, 1.34]] as const) {
      const start = portalDriftLift(phase, pace, 0);
      const cycle = portalDriftLift(phase, pace, PORTAL_DRIFT_PERIOD / pace);
      expect(cycle).toBeCloseTo(start, 9);
      expect(Math.abs(portalDriftLift(phase, pace, 1234.5))).toBeLessThanOrEqual(PORTAL_DRIFT_LIFT);
    }
  });

  it('шейдер рахує те саме, що функція, якою його перевіряють', () => {
    /*
     * Формула написана двічі — у GLSL і в TypeScript, — і це найтонше
     * місце всієї зміни: шейдер тестом не перевіриш, тож тест перевіряє
     * копію. Копія, що розійшлась з оригіналом, стереже те, чого на екрані
     * немає.
     *
     * Тому обидва числа беруться з ОДНИХ сталих, і сюди вони підставлені
     * прямо в текст шейдера. Цей тест звіряє, що підставились саме вони.
     */
    expect(PORTAL_DRIFT_OFFSET_GLSL).toContain(`/ ${PORTAL_DRIFT_PERIOD.toFixed(1)}`);
    expect(PORTAL_DRIFT_OFFSET_GLSL).toContain(`) * ${PORTAL_DRIFT_LIFT.toFixed(4)};`);
    expect(PORTAL_DRIFT_OFFSET_GLSL).toContain('uPortalFloatSeconds * 6.2831853 * portalFloat.y');
    expect(PORTAL_DRIFT_OFFSET_GLSL).toContain('+ portalFloat.x');
    // І та сама вісь: шейдер рухає ТІЛЬКИ висоту.
    expect(PORTAL_DRIFT_OFFSET_GLSL).toContain('transformed.y +=');
    expect(PORTAL_DRIFT_OFFSET_GLSL).not.toContain('transformed.x');
    expect(PORTAL_DRIFT_OFFSET_GLSL).not.toContain('transformed.z');
  });

  it('зупиняється разом із диханням камери, а не окремим прапорцем', () => {
    // §47: зменшений рух зберігає простір і прибирає подорож. Камінь, що
    // гойдається під нерухомою камерою, — це подорож без згоди.
    const rig = readFileSync(join(__dirname, 'PortalEnvironment.tsx'), 'utf8');
    expect(rig).toMatch(/if \(reduceMotion\) return;/);
    const stage = readFileSync(join(__dirname, 'PortalStage.tsx'), 'utf8');
    expect(stage).toContain('reduceMotion={reduceMotion}');
  });
});
