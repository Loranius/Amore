import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PORTAL_PALETTES } from './portalScene';
import {
  PORTAL_SKY_GLOW,
  PORTAL_SKY_STOPS,
  PORTAL_SKY_TEXTURE_HEIGHT,
  PORTAL_SKY_TEXTURE_WIDTH,
  buildPortalSkyTexture,
  portalSkyGlowAt,
  portalSkyPixel,
} from './portalSkyBackdrop';

/*
 * ВИМОГА (ADR-0178): небо в сцені мусить бути ТИМ САМИМ небом, що й у CSS.
 *
 * Воно існує лише заради заломлення — буфер `renderTransmissionPass`
 * містить тільки об'єкти сцени. Але вмикається воно разом із прозорістю
 * тіла, тож якби градієнт розійшовся з CSS, власник побачив би дві зміни
 * одразу й не зміг би сказати, яка з них зіпсувала кадр. Уся користь
 * прапорця тримається на тому, що небо не змінюється.
 */

const BACKDROP_CSS = readFileSync('src/features/home/portalBackdrop.css', 'utf8');

describe('небо в сцені', () => {
  it('бере ті самі зупинки, що й CSS-градієнт', () => {
    /*
     * Дві копії одного градієнта розійдуться того дня, коли хтось
     * поправить одну. Тому відсотки звіряються з самим файлом стилів, а
     * не переписані сюди з пам'яті.
     */
    const linear = BACKDROP_CSS.slice(BACKDROP_CSS.indexOf('linear-gradient('));
    expect(linear).toContain('var(--portal-sky-horizon) 0%');
    expect(linear).toContain('var(--portal-sky-glow) 22%');
    expect(linear).toContain('var(--portal-sky-mid) 56%');
    expect(linear).toContain('var(--portal-sky-deep) 100%');

    expect(PORTAL_SKY_STOPS.map((stop) => stop.at)).toEqual([0, 0.22, 0.56, 1]);
    // Верх кадру — це далина, і фарбує її туман (ADR-0165). Саме тому
    // перша зупинка бере `fog`, а не `skyDeep`, і саме так її ставить CSS.
    expect(PORTAL_SKY_STOPS[0]!.from).toBe('fog');
    expect(PORTAL_SKY_STOPS.at(-1)!.from).toBe('skyDeep');
  });

  it('бере ту саму теплу пляму, що й CSS', () => {
    expect(BACKDROP_CSS).toContain('120% 40% at 68% 16%');
    expect(PORTAL_SKY_GLOW.radiusX).toBe(1.2);
    expect(PORTAL_SKY_GLOW.radiusY).toBe(0.4);
    expect(PORTAL_SKY_GLOW.atX).toBe(0.68);
    expect(PORTAL_SKY_GLOW.atY).toBe(0.16);
    // `transparent 68%` — і саме на цій частці радіуса пляма закінчується.
    expect(BACKDROP_CSS).toContain('transparent 68%');
    expect(PORTAL_SKY_GLOW.fadeAt).toBe(0.68);
  });

  it('пляма найсильніша у своєму центрі й згасає до нуля', () => {
    expect(portalSkyGlowAt(PORTAL_SKY_GLOW.atX, PORTAL_SKY_GLOW.atY)).toBeCloseTo(1, 6);
    // Протилежний нижній кут — найдальша точка кадру від плями.
    expect(portalSkyGlowAt(0, 1)).toBe(0);
    // Монотонність по вертикалі від центру вниз: інакше пляма мала б
    // кільце, а в CSS його немає.
    expect(portalSkyGlowAt(0.68, 0.3)).toBeGreaterThan(portalSkyGlowAt(0.68, 0.5));
  });

  it('будує текстуру тла, а не власний прямокутник перед камерою', () => {
    /*
     * Перша редакція ставила меш, розтягнутий під поле зору, і виміряно,
     * чим це закінчилось: тепла смуга з 27% висоти екрана виїхала на 46%,
     * а розмах градієнта стиснувся майже вдвічі. Тло малює сам `three`, в
     * екранних координатах — рівно так, як CSS розтягує градієнт по
     * елементу, і арифметики кадру тут не лишається взагалі.
     */
    const texture = buildPortalSkyTexture(PORTAL_PALETTES.light);
    expect(texture.image.width).toBe(PORTAL_SKY_TEXTURE_WIDTH);
    expect(texture.image.height).toBe(PORTAL_SKY_TEXTURE_HEIGHT);
    // Байти вже в sRGB — тими самими, якими їх пише CSS.
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    texture.dispose();
  });

  it('низ екрана — це `skyDeep`, і саме той, що в палітрі', () => {
    for (const theme of ['light', 'dark'] as const) {
      const palette = PORTAL_PALETTES[theme];
      // Лівий нижній кут: тепла пляма туди не дістає, тож там видно
      // чистий колір зупинки.
      const deep = new THREE.Color(palette.skyDeep);
      const [r, g, b] = portalSkyPixel(palette, 0, 1);
      expect(r).toBe(Math.round(deep.convertLinearToSRGB().r * 255));
      const top = portalSkyPixel(palette, 0, 0);
      const fog = new THREE.Color(palette.fog).convertLinearToSRGB();
      expect(top[0]).toBe(Math.round(fog.r * 255));
      expect([g, b].every((channel) => channel >= 0 && channel <= 255)).toBe(true);
    }
  });

  it('не перевертає небо: рядок 0 даних — це низ екрана', () => {
    /*
     * Тло малюється площиною, у якої `uv` рахується знизу вгору. Якби цей
     * рядок був верхом, небо стало б дном, а дно небом — і це та помилка,
     * яку на кадрі помітно останньою: градієнт лишається градієнтом.
     */
    const palette = PORTAL_PALETTES.dark;
    const texture = buildPortalSkyTexture(palette);
    const data = texture.image.data as Uint8Array;
    const width = PORTAL_SKY_TEXTURE_WIDTH;
    const bottomRow = data[0]!;
    const topRow = data[(PORTAL_SKY_TEXTURE_HEIGHT - 1) * width * 4]!;
    const deep = new THREE.Color(palette.skyDeep).convertLinearToSRGB();
    const fog = new THREE.Color(palette.fog).convertLinearToSRGB();
    expect(bottomRow).toBe(Math.round(deep.r * 255));
    expect(topRow).toBe(Math.round(fog.r * 255));
    texture.dispose();
  });
});
