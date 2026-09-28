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

  it('небо під сценою — те саме небо діорами обраного виду (ADR-0224)', async () => {
    /*
     * Поки сцена вантажиться, видно CSS-небо. Воно мусить бути тим, яке
     * потім намалює діорама, — інакше між перемиканнями видів блимало
     * небо й картина попереднього кристала (власник). Регресія: у кожного
     * виду й теми CSS-небо бере саме його `DIORAMA_PALETTES`.
     */
    const { portalBackdropColours } = await import('../../PortalBackdrop');
    const { DIORAMA_PALETTES } = await import('../../diorama/dioramaStyle');
    for (const artifact of ['crystal', 'tree', 'reef'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        const colours = portalBackdropColours(artifact, theme);
        expect(colours.top).toBe(DIORAMA_PALETTES[artifact][theme].top);
        expect(colours.bottom).toBe(DIORAMA_PALETTES[artifact][theme].bottom);
      }
    }
    const css = readFileSync(fileURLToPath(new URL('../../portalBackdrop.css', import.meta.url)), 'utf8');
    expect(css).not.toContain('portal-backdrop__painting');
    expect(css).toContain('var(--portal-sky-top)');
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
