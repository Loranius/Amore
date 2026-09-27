import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PORTAL_EYE_ELEVATION_SIN, PORTAL_PALETTES } from './portalPalette';
import * as scene from './portalScene';

// ============================================================
// Легкий модуль палітри (ADR-0212).
// ------------------------------------------------------------
// ВИМОГА: екран входу не тягне Three.js. Виміряно у збірці: поки фон
// порталу брав кольори з `portalScene.ts`, у `modulepreload` першого кадру
// йшли `three.module`, будівник острова й рушій кристала — 413 КБ gzip JS
// проти 195 КБ після винесення. Один рядок `import` тут поверне все назад,
// і ні тип, ні жоден інший тест цього не помітить.
// ============================================================

const source = readFileSync(fileURLToPath(new URL('./portalPalette.ts', import.meta.url)), 'utf8');

describe('portalPalette — без залежностей', () => {
  it('не імпортує нічого: ні Three.js, ні сцену, ні рушій', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\bfrom\s+['"]/);
    expect(source).not.toMatch(/\bimport\(/);
  });

  it('сцена реекспортує ТІ САМІ об’єкти, а не копії', () => {
    // Дві копії палітри розійшлися б того дня, коли хтось поправить одну.
    expect(scene.PORTAL_PALETTES).toBe(PORTAL_PALETTES);
    expect(scene.PORTAL_EYE_ELEVATION_SIN).toBe(PORTAL_EYE_ELEVATION_SIN);
  });
});
