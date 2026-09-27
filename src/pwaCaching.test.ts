import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ============================================================
// Кеш PWA (ADR-0212).
// ------------------------------------------------------------
// Регресії, знайдені аудитом:
//  1. Галерея показує мініатюри `render/image`, а service worker кешував
//     лише оригінали `object/public` — мініатюри йшли з мережі щоразу й
//     офлайн не показувались.
//  2. Шрифт Nunito з Google не кешувався — офлайн застосунок втрачав шрифт.
// Конфіг Vite не виконується в тестах, тож читається його текст.
// ============================================================

const config = readFileSync(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), 'utf8');

describe('кеш PWA', () => {
  it('кешує мініатюри сховища, і лише успішні відповіді', () => {
    const rule = config.slice(config.indexOf('render\\/image'));
    expect(config).toContain('/\\/storage\\/v1\\/render\\/image\\/public\\//');
    expect(rule.slice(0, 400)).toContain("statuses: [200]");
  });

  it('кешує таблицю стилів і файли шрифту Google', () => {
    expect(config).toContain('fonts\\.googleapis\\.com');
    expect(config).toContain('fonts\\.gstatic\\.com');
  });
});
