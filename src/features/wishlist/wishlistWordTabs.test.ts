import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ADR-0255: у світі вкладки вішліста — три слова, а налаштування й
// виконані — під однією кнопкою-значком праворуч, без ручки-розгортки.
const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');

describe('вкладки вішліста словами', () => {
  const page = read('WishlistPageBase.tsx');
  const nav = read('WishlistWorldNav.tsx');
  const tabs = read('WishlistWordTabs.tsx');

  it('у світі стоять слова, поза світом лишається звичний TabBar', () => {
    expect(page).toMatch(/worldVisible\s*\?\s*<WishlistWordTabs/);
    expect(page).toContain("data-words={worldVisible ? 'true' : undefined}");
  });

  it('слова — справжні вкладки для читача екрана', () => {
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('role="tab"');
    expect(tabs).toContain('aria-selected={item.value === value}');
  });

  it('розгортка — одна кнопка зі своєю назвою, без ручки на всю ширину', () => {
    expect(nav).toContain('aria-label="Вигляд і виконані"');
    expect(nav).not.toContain('wl-top-filter-grip');
    expect(nav).not.toContain('ChevronDownIcon');
  });
});
