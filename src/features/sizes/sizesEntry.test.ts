import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MORE_GROUPS, MORE_ITEMS, MORE_PREFIXES } from '@/app/nav';

/*
 * ВИМОГА: «Заміри» — окремий модуль у «Ще», поруч із грою, і єдиний вхід
 * до них.
 *
 * Модуль без входу — це код, якого пара ніколи не побачить, а два входи в
 * те саме місце — портал, який учить себе двічі. Обидві помилки тихі:
 * жодна не ламає складання. Тому вони перевіряються тут.
 */

const SRC = join(__dirname, '..', '..');
const routes = readFileSync(join(SRC, 'app', 'routes.tsx'), 'utf8');
const settings = readFileSync(join(SRC, 'features', 'settings', 'SettingsModal.tsx'), 'utf8');
const index = readFileSync(join(SRC, 'index.css'), 'utf8');

describe('вхід у «Заміри»', () => {
  it('стоїть у «Ще» поруч із грою', () => {
    const group = MORE_GROUPS.find((one) => one.items.some((item) => item.to === '/sizes'));
    expect(group, 'заміри мають бути в меню «Ще»').toBeDefined();
    const labels = group!.items.map((item) => item.label);
    expect(labels).toContain('Гра');
    // Сусідство, а не просто «десь у тій самій групі»: власник просив
    // поставити модуль ПОРУЧ із грою.
    expect(Math.abs(labels.indexOf('Заміри') - labels.indexOf('Гра'))).toBe(1);
  });

  it('має рівно один пункт і потрапляє в підсвітку «Ще»', () => {
    expect(MORE_ITEMS.filter((item) => item.to === '/sizes')).toHaveLength(1);
    expect(MORE_PREFIXES).toContain('/sizes');
  });

  it('має роут, і той роут лінивий, як решта модулів', () => {
    expect(routes).toContain("path: 'sizes'");
    expect(routes).toContain("import('@/features/sizes/SizesPage')");
  });
});

describe('у налаштуваннях замірів більше немає', () => {
  it('модалка про них не знає', () => {
    // Другий вхід у той самий модуль — це не запасний шлях, це два різні
    // місця, у яких пара шукатиме одне й те саме.
    expect(settings).not.toContain('SizesSection');
    expect(settings).not.toContain('useUserSizes');
    expect(settings).not.toContain("label: 'Розміри'");
  });

  it('старі стилі прибрані разом із розміткою', () => {
    /*
     * Не прибирання заради чистоти: класи нового модуля називаються так
     * само (`.sizes-row`), і старе правило — рядок таблиці — сперечалося
     * б із новим, де це кнопка на всю ширину картки.
     */
    expect(index).not.toContain('.sizes-grid');
    expect(index).not.toContain('.sizes-form-group');
    expect(index.includes('.sizes-row {')).toBe(false);
  });
});

describe('виділення тексту лишається одним правилом', () => {
  it('має рівно одне `::selection` на весь портал', () => {
    /*
     * ЦЕЙ ТЕСТ НАРОДИВСЯ З ПОМИЛКИ, зробленої в цій же зміні.
     *
     * `amore-frontend-craft` каже, що виділення «не стилізоване ніде», і
     * я дописав правило. Воно вже було — з 485-го рядка, з власним
     * виміром у коментарі. Два правила на один селектор не сваряться
     * помітно: перемагає останнє, і різниця в один токен тихо переїжджає
     * по всьому порталу.
     */
    const rules = index.split('::selection {').length - 1;
    expect(rules).toBe(1);
    const rule = index.slice(index.indexOf('::selection {'), index.indexOf('::selection {') + 160);
    expect(rule).toContain('--accent');
  });
});
