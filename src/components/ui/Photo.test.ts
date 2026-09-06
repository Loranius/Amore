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
    // `pixelRatio` бере ширину кадру: стеля щільності залежить від неї
    // (ADR-0144) — дрібні кадри дістають до 3, великі лишаються на 2.
    expect(PHOTO).toContain('Math.round(cssWidth * pixelRatio(cssWidth))');
  });

  it('ОРІЄНТАЦІЯ ЗАДАЄТЬСЯ ЯВНО, а не залежить від версії браузера', () => {
    /*
     * `<img>` повертає знімок за EXIF сам, а `createImageBitmap` довгий
     * час цього не робив: типовим у першій редакції специфікації було
     * `none`, і браузери переходили на `from-image` у різні роки. Отже
     * рятівний шлях міг покласти знімок набік саме там, де решта шляхів
     * кладе його правильно, — тобто по-різному на різних платформах.
     */
    expect(PHOTO).toContain("imageOrientation: 'from-image'");
  });

  it('декодує асинхронно за замовчуванням, а не за проханням кожного місця', () => {
    // Синхронне декодування тримає головний потік рівно тоді, коли картка
    // в'їжджає у в'юпорт: виміряно 554 мс на одному великому знімку.
    // `rest` іде ПІСЛЯ, тож будь-яке місце може перевизначити.
    expect(PHOTO).toMatch(/decoding="async"\s*\n\s*\{\.\.\.rest\}/);
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
