import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================
// Чи існує те, що імпортують приймальні спеки (ADR-0172).
// ------------------------------------------------------------
// ВАДА, ЯКУ ЦЕ ЗАМИКАЄ. `e2e/visual/home-artifact-switcher.spec.ts`
// імпортував чотири модулі старої підсистеми рифа. Підсистему видалили
// 25 серпня («−27 403 рядки»), спеку лишили — і Playwright почав падати
// на ЗАВАНТАЖЕННІ модуля, тобто набір не запускався ВЗАГАЛІ.
//
// Ціна виявилась значно більшою за мертву перевірку рифа: разом із ним
// два тижні не працювали живі перевірки кристала й дерева — ті самі, що
// стережуть бюджети draw call'ів і трикутників. Мертвий тест не «просто
// червоний»: він тягне за собою живі.
//
// ЧОМУ ЦЬОГО НЕ ЛОВИВ ТИПЧЕК. `tsconfig.json` має `include: ["src",
// "vite.config.ts"]` — каталог `e2e` у програму не входить узагалі. Додати
// його не можна дешево: спеки тягнуть `@playwright/test`, якого немає ні в
// залежностях, ні в пісочниці. Тому перевірка тут робить рівно те, що
// потрібно, і нічого більше: читає імпорти спек і питає, чи файли на місці.
// ============================================================

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function specs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...specs(path));
    else if (entry.name.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** Чи можна дорезолвити відносний імпорт до справжнього файлу. */
function resolves(from: string, target: string): boolean {
  const base = resolve(dirname(from), target);
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].some(
    (suffix) => existsSync(base + suffix),
  );
}

describe('приймальні спеки не імпортують видаленого коду', () => {
  it('кожен відносний імпорт із e2e веде у справжній файл', () => {
    const dead: string[] = [];
    for (const spec of specs(resolve(root, 'e2e'))) {
      const source = readFileSync(spec, 'utf8');
      for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
        const target = match[1]!;
        if (!resolves(spec, target)) dead.push(`${spec.slice(root.length + 1)} → ${target}`);
      }
    }
    expect(dead, `спеки посилаються на неіснуючі модулі:\n${dead.join('\n')}`).toEqual([]);
  });
});
