import { expect, test, type Page } from '@playwright/test';
/*
 * ІМПОРТІВ ІЗ СТАРОЇ ПІДСИСТЕМИ РИФА ТУТ БІЛЬШЕ НЕМАЄ (ADR-0172).
 *
 * Їх було чотири — `reefFoundationPresentation`, `reefFishSchoolMotion`,
 * `reefFishSchoolPresentation`, `reefMaterialPresentation`, — і всі
 * чотири зникли 25 серпня разом із самою підсистемою («Стару підсистему
 * рифа видалено: −27 403 рядки»). Спека лишилась.
 *
 * Ціна виявилась значно більшою за мертву перевірку рифа: Playwright
 * падав на ЗАВАНТАЖЕННІ модуля, тобто набір не запускався ВЗАГАЛІ. Разом
 * із рифом два тижні не працювали живі перевірки кристала й дерева — ті
 * самі, що стережуть бюджети draw call'ів і трикутників.
 *
 * Мораль: мертвий тест не «просто червоний». Він тягне за собою живі.
 */

const userName = process.env.VISUAL_USER_NAME ?? '';
const userPin = process.env.VISUAL_USER_PIN ?? '';

async function login(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('button', { name: userName, exact: true }).click();
  for (const digit of userPin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('Home artifact switcher Pixel 8 Pro', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('switches between the accepted Crystal, Tree and Reef renderers', async ({ page }) => {
    test.slow();
    await login(page, '?artifact=crystal#/login');

    const home = page.locator('.home');
    const switcher = page.locator('[data-home-artifact-switcher="ready"]');
    await expect(home).toHaveAttribute('data-home-artifact', 'crystal');
    await expect(switcher).toBeVisible();
    await expect(page.locator('[data-evolution-preview="ready"]')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('heading', { name: 'Кристал Amore' })).toBeVisible();
    await page.screenshot({
      path: 'test-results/home-artifact-crystal-pixel-8-pro.png',
      fullPage: true,
    });

    await page.getByRole('tab', { name: 'Дерево', exact: true }).click();
    await expect(home).toHaveAttribute('data-home-artifact', 'tree');
    await expect(page.getByRole('heading', { name: 'Дерево Amore' })).toBeVisible();
    const tree = page.locator('[data-evolution-preview="ready"][data-evolution-species="tree"]');
    await expect(tree).toBeVisible({ timeout: 25_000 });
    await page.screenshot({
      path: 'test-results/home-artifact-tree-pixel-8-pro.png',
      fullPage: true,
    });

    /*
     * РИФ ПЕРЕВІРЯЄТЬСЯ РІВНО НА ТЕ, ЩО ВІН ПУБЛІКУЄ СЬОГОДНІ.
     *
     * Тут стояло сорок перевірок старої підсистеми: `data-reef-fish-*`,
     * `data-reef-material-pass`, `data-reef-foundation-*`,
     * `data-reef-acceptance`, підпис збірки, бюджети вершин і колоній.
     * Жодного з цих атрибутів новий світ рифа (`reef3d/world`) не
     * виставляє — він публікує `data-reef-preview` і план колоній.
     *
     * Перевірки не «полагоджені», а ЗНЯТІ: код, який вони стерегли,
     * видалено. Коли світ рифа доросте до власного приймального
     * контракту, він дістане власну спеку — і це має бути свідомий крок,
     * а не відновлення сорока рядків про рибу, якої немає.
     */
    await page.getByRole('tab', { name: /Риф/ }).click();
    await expect(home).toHaveAttribute('data-home-artifact', 'reef');
    await expect(page.getByRole('heading', { name: 'Риф Amore' })).toBeVisible();
    const reef = page.locator('[data-reef-preview="ready"]');
    await expect(reef).toBeVisible({ timeout: 25_000 });
    await expect(reef).toHaveAttribute('data-reef-years', /^[0-9]+$/);
    await page.screenshot({
      path: 'test-results/home-artifact-reef-pixel-8-pro.png',
      fullPage: true,
    });

    // Вибір артефакта переживає перезавантаження — це та частина, яка
    // стосується перемикача, а не рифа, і вона лишається.
    await page.reload();
    await expect(home).toHaveAttribute('data-home-artifact', 'reef');
    await expect(page.locator('[data-reef-preview="ready"]')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('tab', { name: /Риф/ })).toHaveAttribute('aria-selected', 'true');
  });
});
