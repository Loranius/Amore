import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DIORAMA_SHADE } from './dioramaStyle';

// ============================================================
// Світло й тінь діорами (власник, 2026-10-04: «покращ візуально сцени
// усіх об'єктів, додай світло і тіні»). Один шматок GLSL світить кристал,
// дерево й вулкан, тож тут і тримається: тепле світло проти холодної
// тіні, відблиск, що залежить від погляду, і контактна тінь під предметом.
// ============================================================

const diorama = readFileSync(fileURLToPath(new URL('./Diorama.tsx', import.meta.url)), 'utf8');

describe('світло діорами', () => {
  it('тінь холодна, світло тепле, і зворотний бік не йде в чорне', () => {
    expect(DIORAMA_SHADE).toMatch(/vec3\(0\.84, 0\.88, 1\.1\)/);
    expect(DIORAMA_SHADE).toMatch(/mix\(0\.74, 1\.0/);
  });

  it('відблиск — від погляду й лише на освітленому боці', () => {
    expect(DIORAMA_SHADE).toMatch(/normalize\(uKey \+ view\)/);
    expect(DIORAMA_SHADE).toMatch(/step\(0\.0, ndl\)/);
  });

  it('під предметом лежить м\'яка контактна тінь, зсунута від світла', () => {
    expect(diorama).toMatch(/createShadowMaterial\(palette\.ground\)/);
    expect(diorama).toMatch(/DIORAMA_SHADOW_SHIFT\[0\] \* radius/);
  });
});
