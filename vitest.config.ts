// Тести рушія артефакту — чисті дані (artifact/ не імпортує THREE/React),
// тому достатньо node-середовища без DOM/jsdom.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Скрипти живої перевірки теж мають чисту частину — розбір аргументів,
    // де мовчазна помилка коштує знімка не того екрана.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
  // Той самий аліас, що у vite.config.ts. Донедавна тести жили лише в
  // artifact/, де всі імпорти відносні, тож аліас був не потрібен — і
  // перший же тест поза рушієм падав на «Cannot find package '@/…'».
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
