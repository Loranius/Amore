import type { Page } from '@playwright/test';

/**
 * Вхід поштою й паролем (ADR-0228) — один на всі візуальні специфікації.
 *
 * Раніше кожна специфікація мала власний `enterPin`: обирала ім'я й тиснула
 * вісім цифр. PIN на екрані входу більше немає (обидва місця пари прив'язані
 * до пошти), тож три копії зламались би разом; одна функція ламається раз.
 */
export const visualUserEmail = process.env.VISUAL_USER_EMAIL?.trim() ?? '';
export const visualUserPassword = process.env.VISUAL_USER_PASSWORD ?? '';
export const hasVisualCredentials = visualUserEmail !== '' && visualUserPassword !== '';

export async function loginByEmail(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Вхід' }).click();
  await page.getByLabel('Пошта').fill(visualUserEmail);
  await page.getByLabel('Пароль').fill(visualUserPassword);
  await page.getByRole('button', { name: 'Увійти' }).click();
}
