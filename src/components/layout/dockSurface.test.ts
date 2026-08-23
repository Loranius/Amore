import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  fileURLToPath(new URL('../../index.css', import.meta.url)),
  'utf8',
);
const WORLD_SURFACE = readFileSync(
  fileURLToPath(new URL('../../features/world/worldSurface.css', import.meta.url)),
  'utf8',
);

/**
 * Той самий CSS без коментарів, але з тими самими номерами рядків.
 *
 * Коментарі в цьому проєкті цитують саме ті вади, які перевіряються, —
 * а пошук підрядком не відрізняє цитату в поясненні від живого
 * оголошення. Пробіли замість тексту зберігають розкладку файлу, тож
 * номери рядків у звіті лишаються справжніми.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

const CODE = stripComments(CSS);
const WORLD_CODE = stripComments(WORLD_SURFACE);

function rule(source: string, selector: string): string {
  const at = source.indexOf(`${selector} {`);
  expect(at, `немає правила ${selector}`).toBeGreaterThan(-1);
  return source.slice(at, source.indexOf('}', at));
}

describe('поверхня дока', () => {
  it('док непрозорий на КОЖНОМУ маршруті, а не лише там, де видно сцену', () => {
    /*
     * Виміряна вада, і мовчазна.
     *
     * Було `background: var(--glass-2), var(--surface)`. `--glass-2`
     * розкривається у ДВА значення, і друге з них — колір
     * (`color-mix(…)`). У CSS колір дозволений лише в ОСТАННЬОМУ шарі
     * фону; колір усередині списку робить УСЕ оголошення недійсним, і
     * браузер його викидає — без жодної помилки.
     *
     * Виміряно на живому порталі: на `/memories`, `/media`, `/schedule`,
     * `/piggybank` обчислений стиль дока був
     * `background-color: rgba(0, 0, 0, 0)` і `background-image: none`,
     * тобто док був ПОВНІСТЮ прозорий і підписи лежали просто на фото.
     * У «Планах» і «Вішлисті» вади не було видно лише тому, що там док
     * перекривало окреме правило сцени.
     */
    const dock = rule(CODE, '.bottom-nav');
    expect(dock).toContain('background: var(--world-surface)');
    expect(dock).not.toContain('var(--glass-2), var(--surface)');
    // Позитивна половина §13, що переїхала сюди разом із правилом: док —
    // те єдине, що розмивається, бо він один на екран і лежить просто на
    // артефакті. `worldSurface.test.ts` стереже, що в тому файлі не
    // з'явиться жодного власного розмиття.
    expect(dock).toMatch(/backdrop-filter:\s*blur/);
  });

  it('жоден фон не кладе колір у не-останній шар', () => {
    // Та сама пастка в загальному вигляді: `background: <токен-із-двох>,
    // <колір>` мовчки вимикає весь фон. Токени скла закінчуються
    // кольором, тож ставити щось ПІСЛЯ них не можна.
    // Коментарі не рахуються: вони цитують стару ваду, пояснюючи її, і
    // цитата в поясненні — не друге оголошення.
    const offenders: string[] = [];
    for (const [index, line] of CODE.split('\n').entries()) {
      if (/background:\s*var\(--glass-[\w-]+\)\s*,/.test(line)) {
        offenders.push(`index.css:${index + 1}  ${line.trim()}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('рецепт поверхні дока лишається один', () => {
    // Правило сцени дублювало базове дослівно. Дві копії розійшлись би
    // на першій же правці — і вада повернулась би саме туди, звідки її
    // прибрали.
    expect(WORLD_CODE).not.toMatch(
      /\[data-portal-scene='true'\] \.bottom-nav \{[^}]*background:/,
    );
  });
});

describe('кнопки свайпу не ховаються під доком', () => {
  it('висота колоди рахується від екрана, а не константою', () => {
    /*
     * Виміряно на живому екрані, телефон 412×915: з фіксованими 460px і
     * доданим рядом жанрів низ кнопок був на 872, а верх дока — на 831.
     * `elementFromPoint` у центрі кнопки повертав `nav-btn`, тобто док:
     * дотик по «Переглянуто» відкривав розділ замість позначення фільму.
     */
    const stack = rule(CODE, '.swipe-stack');
    expect(stack).toContain('clamp(');
    expect(stack).toContain('dvh');
    expect(stack).not.toMatch(/height:\s*460px/);
  });
});
