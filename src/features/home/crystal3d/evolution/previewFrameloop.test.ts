import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Полотно модуля не малює кадрів під чужим повним екраном.
// ------------------------------------------------------------
// `CrystalScene` і `ReefPreviewScene` поважали `useWorldFrameloop` від
// самого початку, ці два — ні, і це був недогляд, а не рішення. Ціна
// виміряна на живому екрані: коли поверх модуля відкривалась карта
// спогадів, телефон малював дві сцени, з яких одна повністю схована. На
// слабкому GPU головний потік не відповідав жодного разу за 50 секунд і
// карта не встигала попросити ні одного тайла; з паузою вона готова за
// п'ять секунд.
//
// Тест дивиться в текст файлів навмисно: підняти обидві сцени в jsdom
// означає підняти WebGL, якого там немає.
// ============================================================

const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');

describe('превʼю еволюції: кадри лише коли видно', () => {
  for (const name of ['EvolutionCrystalPreviewScene.tsx', 'EvolutionTreePreviewScene.tsx']) {
    it(`${name} питає про паузу і віддає її полотну`, () => {
      const source = read(name);
      expect(source).toMatch(/const frameloop = useWorldFrameloop\(\)/);
      expect(source).toMatch(/frameloop=\{frameloop\}/);
    });
  }
});
