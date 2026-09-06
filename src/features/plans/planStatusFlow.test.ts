import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAN_STATUSES, PLAN_STATUS_ORDER } from './planConstants';
import { nextActiveStatus } from './planModel';

describe('наступний стан плану', () => {
  it('веде робочими станами по порядку', () => {
    const active = PLAN_STATUS_ORDER.filter((key) => !PLAN_STATUSES[key].closed);
    for (let index = 0; index + 1 < active.length; index += 1) {
      expect(nextActiveStatus(active[index]!)).toBe(active[index + 1]);
    }
  });

  it('на останньому робочому стані наступного немає', () => {
    const active = PLAN_STATUS_ORDER.filter((key) => !PLAN_STATUSES[key].closed);
    expect(nextActiveStatus(active[active.length - 1]!)).toBeNull();
  });

  it('закритий стан не має наступного: це вихід зі шляху, а не крок ним', () => {
    for (const key of PLAN_STATUS_ORDER) {
      if (!PLAN_STATUSES[key].closed) continue;
      expect(nextActiveStatus(key), key).toBeNull();
    }
  });
});

describe('карта плану не тримає двох входів в один аркуш (ADR-0133)', () => {
  /*
   * Вада, яку це закриває, була структурна, а не смакова: блоки «Місця» й
   * «Пов'язане» обидва викликали `setSheet('links')`, а «Пов'язане» вже
   * містило рядок «Місця N» — те саме число, що показував сусід. Карта
   * витрачала на одну річ два з семи блоків, маючи 12 px запасу з 739.
   *
   * Тест читає розмітку, бо саме там живе ця властивість: вона не в
   * чистій функції й не в стилі.
   */
  const source = readFileSync('src/features/plans/PlanDetailsPage.tsx', 'utf8');

  it('кожен аркуш карти відкривається рівно з одного блока', () => {
    const opens = [...source.matchAll(/setSheet\('(\w+)'\)/g)].map((hit) => hit[1]!);
    // Рахуються лише виклики з `onOpen` блоків карти: аркуші відкриваються
    // ще й із власних кнопок усередині блоків, і це інша річ.
    const fromBlocks = [...source.matchAll(/onOpen=\{\(\) => \{?[^}]*setSheet\('(\w+)'\)/g)]
      .map((hit) => hit[1]!);
    expect(opens.length).toBeGreaterThan(0);
    const seen = new Map<string, number>();
    for (const sheet of fromBlocks) seen.set(sheet, (seen.get(sheet) ?? 0) + 1);
    const twice = [...seen.entries()].filter(([, count]) => count > 1);
    expect(twice, 'аркуші з двома входами з карти').toEqual([]);
  });

  it('блок «Місця» не повертається окремо від «Пов’язаного»', () => {
    expect(source).not.toMatch(/id="place"/);
  });
});
