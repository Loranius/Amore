import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prefetchAllowed } from './routePrefetch';

const ROUTES = readFileSync(
  fileURLToPath(new URL('./routes.tsx', import.meta.url)),
  'utf8',
);
const PREFETCH = readFileSync(
  fileURLToPath(new URL('./routePrefetch.ts', import.meta.url)),
  'utf8',
);
const LAZY_ROUTE = readFileSync(
  fileURLToPath(new URL('./lazyRoute.ts', import.meta.url)),
  'utf8',
);

describe('коли прогрів дозволений', () => {
  it('без даних про мережу — гріємо', () => {
    // `navigator.connection` немає в Safari. Якби відсутність читалась як
    // заборона, прогрів не працював би на iOS узагалі.
    expect(prefetchAllowed(undefined)).toBe(true);
    expect(prefetchAllowed(null)).toBe(true);
    expect(prefetchAllowed({})).toBe(true);
  });

  it('«економія трафіку» — це пряме прохання, і воно сильніше за швидкість', () => {
    expect(prefetchAllowed({ saveData: true })).toBe(false);
    expect(prefetchAllowed({ saveData: true, effectiveType: '4g' })).toBe(false);
  });

  it('на повільній мережі прогрів лише відбирає смугу в поточного екрана', () => {
    expect(prefetchAllowed({ effectiveType: 'slow-2g' })).toBe(false);
    expect(prefetchAllowed({ effectiveType: '2g' })).toBe(false);
    expect(prefetchAllowed({ effectiveType: '3g' })).toBe(true);
    expect(prefetchAllowed({ effectiveType: '4g' })).toBe(true);
  });
});

describe('прогрів переживає подвійне монтування StrictMode', () => {
  it('прапорець «один раз» ставиться на ПОЧАТКУ роботи, а не на плануванні', () => {
    /*
     * Виміряна вада, а не теорія. У `StrictMode` React монтує ефект
     * двічі: монтування → прибирання → монтування. Коли прапорець
     * ставився при плануванні, перший ефект займав його, прибирання
     * скасовувало заплановане, а другий упирався в зайнятий прапорець —
     * і не грілось НІЧОГО. Живий екран показав порожній список
     * прогрітих чанків після дев'яти секунд на головній.
     */
    const idle = PREFETCH.slice(PREFETCH.indexOf('const cancelIdle = whenIdle('));
    expect(idle).toMatch(/if \(cancelled \|\| started\) return;\s*\n\s*started = true;/);
    // І навпаки: до планування прапорець ставити не можна.
    expect(PREFETCH).not.toMatch(/started = true;\s*\n\s*let cancelled/);
  });
});

describe('прогрів гріє саме те, що потім поїде', () => {
  it('гріються `preload` розділів, а не сирі імпорти', () => {
    // Сирий `loadX` прогрів би лише мережу — `React.lazy` усе одно
    // призупинив би перший показ, і скелет маршруту лишився б на місці.
    // Виміряно на продакшн-збірці: ~300 мс `.page-skeleton` на кожному
    // з трьох розділів попри вже прогріті чанки.
    const block = ROUTES.slice(ROUTES.indexOf('PREFETCHED_ROUTE_CHUNKS'));
    for (const route of ['WishlistPage', 'PlansPage', 'ShoppingPage', 'MemoriesPage']) {
      expect(block).toContain(`${route}.preload`);
    }
  });

  it('завантажувач і `lazy` беруть той самий специфікатор', () => {
    // Vite склеює `import()` за ТЕКСТОМ специфікатора. Копія з іншим
    // написанням дала б другий чанк, і прогрів гріл би не те.
    for (const [name, path] of [
      ['loadWishlist', '@/features/wishlist/WishlistPage'],
      ['loadPlans', '@/features/plans/PlansPage'],
      ['loadShopping', '@/features/shopping/ShoppingPage'],
      ['loadMemories', '@/features/memories/MemoriesPage'],
    ]) {
      expect(ROUTES).toContain(`const ${name} = () => import('${path}')`);
    }
  });
});

describe('прогрітий розділ рендериться без Suspense', () => {
  it('вибір «готовий чи лінивий» робиться один раз на монтування', () => {
    // Якби вибір перечитувався щорендеру, прогрів, що завершився вже
    // ПІСЛЯ монтування розділу, змінив би тип елемента — а це для React
    // розмонтування піддерева: розділ смикнувся б і втратив стан.
    expect(LAZY_ROUTE).toContain('const [Resolved] = useState(() => ready);');
  });
});
