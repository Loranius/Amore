import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Прикраса, яка не приїхала, не забирає риф із собою.
// ------------------------------------------------------------
// **Виміряно на живому екрані.** Модель зграї риб не завантажилась
// (`Could not load /models/school_of_fish_reef.glb`), і пара побачила не
// риф без риб, а НЕ РИФ ВЗАГАЛІ: помилка піднялась до
// `CrystalErrorBoundary` навколо всього артефакта.
//
// Навколо риб уже стояв `<Suspense fallback={null}>`, і це виглядало як
// захист. Suspense ловить ОЧІКУВАННЯ, а не помилку — тому межа мусить
// стояти НАВКОЛО нього, а не всередині.
//
// Файл моделі генерується в CI (`scripts/reef/materialize_school_fish.sh`)
// і в git не лежить, тож 404 на ньому — не гіпотеза.
// ============================================================

const source = readFileSync(join(__dirname, 'ReefStage.tsx'), 'utf8');

describe('межа прикрас рифу', () => {
  it('зграя риб загорнута в межу помилки', () => {
    expect(source).toMatch(/<SceneDecorationBoundary what="зграя риб">/);
  });

  it('межа стоїть НАВКОЛО Suspense, а не всередині', () => {
    // Порядок відкриття тегів і є інваріантом: Suspense усередині межі —
    // захищено; межа всередині Suspense — ні.
    const boundary = source.indexOf('<SceneDecorationBoundary');
    const suspense = source.indexOf('<Suspense', boundary);
    const fish = source.indexOf('<ReefFishSchool', boundary);
    expect(boundary).toBeGreaterThan(-1);
    expect(suspense).toBeGreaterThan(boundary);
    expect(fish).toBeGreaterThan(suspense);
  });
});
