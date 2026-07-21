// Тести рушія артефакту — чисті дані (artifact/ не імпортує THREE/React),
// тому достатньо node-середовища без DOM/jsdom.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
