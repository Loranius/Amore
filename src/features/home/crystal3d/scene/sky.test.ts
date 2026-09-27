import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  buildPortalIslandGeometry,
} from './portalIsland';
import { portalCameraFrame } from './portalScene';

// ============================================================
// Небо порталу — ADR-0165.
// ------------------------------------------------------------
// Одна геометрична обставина тримає весь цей файл: ГОРИЗОНТ ЛЕЖИТЬ НАД
// ВЕРХНІМ КРАЄМ КАДРУ. Камера дивиться вниз під asin(0.4) = 23.6°, а
// половина поля зору по вертикалі — 21°, тож промінь горизонту виходить
// за верхній край. Отже все, що видно, лежить під горизонтом, і в кадрі
// ДАЛЕКЕ — ЦЕ ВГОРІ.
//
// З цього випливають обидві вимоги нижче: небо мусить починатись угорі
// кольором туману (бо туман фарбує далеке), а хмара мусить слабшати з
// віддаллю (бо туман до неї не дістає й зробити цього за неї не може).
// ============================================================


/** Той самий нахил, що в `portalCameraFrame`. Зміна тут — зміна ADR. */
const EYE_ELEVATION_SIN = 0.4;

describe('небо порталу (ADR-0165)', () => {
  it('тримає горизонт над верхнім краєм кадру', () => {
    /*
     * Це не смак кадрування, а посилка обох правил нижче. Поки промінь
     * горизонту лишається за кадром, «далеко» означає «вище»; щойно він
     * зайде в кадр, порядок зупинок неба доведеться перекладати наново,
     * і цей тест має впасти першим.
     */
    const frame = portalCameraFrame(1, 6);
    const halfFov = (frame.fov / 2) * (Math.PI / 180);
    const pitch = Math.asin(EYE_ELEVATION_SIN);
    expect(pitch).toBeGreaterThan(halfFov);
  });

  it('починає небо кольором туману, а не зеніту', () => {
    /*
     * Далеке в кадрі стоїть УГОРІ, і туман фарбує далеке у `fog`. Якщо
     * верх градієнта не той самий колір, далина тане в один колір на тлі
     * іншого — і кадр це показав: розрив дальніх хмар із небом був 58.6
     * з 255 проти 44.9 у ближніх, тобто далина читалась гучніше за
     * близину, тоді як повітряна перспектива вимагає протилежного.
     *
     * Перевіряється сам CSS, а не намір: значення градієнта живуть у
     * таблиці стилів, і саме там була вада.
     */
    const css = readFileSync(
      fileURLToPath(new URL('../../portalBackdrop.css', import.meta.url)),
      'utf8',
    );
    const rule = css.slice(css.indexOf('.portal-backdrop__sky {'));
    const gradient = rule.slice(rule.indexOf('linear-gradient'), rule.indexOf(');', rule.indexOf('linear-gradient')));
    const stops = [...gradient.matchAll(/var\(--portal-sky-([a-z]+)\)\s+(\d+)%/g)]
      .map(([, name, percent]) => ({ name, percent: Number(percent) }));
    expect(stops.map((stop) => stop.percent)).toEqual([...stops.map((stop) => stop.percent)].sort((a, b) => a - b));
    expect(stops[0]?.name).toBe('horizon');
    expect(stops.at(-1)?.name).toBe('deep');
  });

  it('дає горизонту неба той самий колір, що й туману сцени', () => {
    // Дві копії одного кольору розходяться того дня, коли хтось поправить
    // одну; тому `--portal-sky-horizon` береться з `fog`, а не з літерала.
    const backdrop = readFileSync(
      fileURLToPath(new URL('../../PortalBackdrop.tsx', import.meta.url)),
      'utf8',
    );
    expect(backdrop).toContain("'--portal-sky-horizon': PORTAL_PALETTES[theme].fog");
    expect(backdrop).toContain("'--portal-sky-deep': PORTAL_PALETTES[theme].skyDeep");
  });



  it('не ставить четвертий канал там, де всі тіла суцільні', () => {
    /*
     * Той самий закон, що й в атрибуті руху: меш, у якому нічого не
     * прозоре, не має носити канал, у якому всюди одиниця. Інакше
     * `USE_COLOR_ALPHA` вмикається на всій сцені заради нічого.
     */
    const island = buildPortalIslandGeometry(11, 6);
    expect((island.getAttribute('color') as THREE.BufferAttribute).itemSize).toBe(3);
    island.dispose();
  });
});
