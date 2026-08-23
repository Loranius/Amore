import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Тест дивиться в текст файлу навмисно, за тим самим підходом, що й решта
// джерела-охоронних тестів порталу: рантайм тут — DOM-ефекти й canvas,
// а компонентний рендер поза jsdom у цьому проєкті не запускається взагалі
// (`vitest.config.ts` бере лише `.test.ts`, середовище `node`).
const PHOTO = readFileSync(
  fileURLToPath(new URL('./Photo.tsx', import.meta.url)),
  'utf8',
);

describe('<Photo> — рятунок завеликого оригіналу', () => {
  it('ніколи не малює сирий оригінал, поки рятівне стиснення в польоті', () => {
    // Вимірювана вада: `<img src="…оригінал">` на 50-мегапіксельному фото
    // коштувала 554 мс головного потоку — саме заскоки під час скролу
    // галереї. Поки `rescued` не готовий, `src` мусить лишатись
    // відсутнім, а не оригіналом — і не порожнім рядком, бо React сам
    // попереджає, що той може змусити браузер перезавантажити сторінку.
    expect(PHOTO).toMatch(/rescued\s*\?\?\s*\(\s*failed\s*\n\s*\?\s*\(rescueFailed\s*\?\s*original\s*:\s*undefined\)/);
  });

  it('декодує оригінал одразу в потрібний розмір, а не в повний растр', () => {
    expect(PHOTO).toContain('createImageBitmap(source, {');
    expect(PHOTO).toContain('resizeWidth: targetPx');
    expect(PHOTO).toContain('resizeHeight: targetPx');
  });

  it('розмір цілі рахує від cssWidth і щільності екрана, а не від оригіналу', () => {
    expect(PHOTO).toContain('Math.round(cssWidth * pixelRatio())');
  });

  it('прибирає власний objectURL рівно того запуску, що його створив', () => {
    // Спільне поле тут — конкретна пастка: друге фото відкликало б щойно
    // створений URL першого до того, як `<img>` встиг би його намалювати.
    expect(PHOTO).not.toMatch(/const objectUrl = useRef/);
    expect(PHOTO).toContain('let createdUrl: string | null = null;');
    expect(PHOTO).toMatch(/if \(createdUrl\) URL\.revokeObjectURL\(createdUrl\);/);
  });

  it('не ховає фото назавжди, коли рятунок сам не зміг', () => {
    // Старий браузер без `createImageBitmap`, обірвана мережа — тоді
    // повний оригінал (з ціною одного застигу) кращий за порожню рамку
    // назавжди.
    expect(PHOTO).toContain('setRescueFailed(true)');
    expect(PHOTO).toMatch(/rescueFailed\s*\?\s*original\s*:\s*undefined/);
  });
});
