# ADR-0002 — Відкат Godot-рушія для кристала Amore

- **Статус:** Accepted
- **Дата:** 2026-08-02
- **Зачіпає:** архітектуру рендерингу (Volume V/VI adapters), CI/CD, production rollout
- **Тип зміни за `CHANGE_CONTROL_AND_ADR.md`:** видалення виконавчого рушія та
  заміна persistence/execution model назад на попередню

## Контекст

Протягом кількох днів у `main` влився паралельний GDScript-рушій
(`godot/evolution-engine/`, ~5 000 рядків) — Godot 4.7.1 web-білд, який
повторно реалізовував Volume I–V логіку кристала (рух, геометрія, злиття),
підключений до застосунку через iframe + postMessage-міст
(`src/features/home/godot3d/`) і виведений на production canary до
ramp-50% трафіку через `.github/workflows/deploy.yml`.

Рев'ю коду й візуальна перевірка живого білда виявили:

1. **Немає ADR на впровадження.** `CHANGE_CONTROL_AND_ADR.md` вимагає ADR для
   заміни виконавчого профілю; його не було, а CLAUDE.md прямо забороняє
   дублювати існуючий рендерер замість адаптації.
2. **Дублювання, не адаптація.** GDScript заново реалізовував те, що вже є в
   25 000-рядковому TS-рушії (`src/engine/`), яким напряму, без мосту,
   користується Three.js/R3F рендерер (`src/features/home/crystal3d/`).
   Жодного тесту, що звіряє канонічний hash TS- і GDScript-виводу для
   однакового seed, не існувало.
3. **Порушення `CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md`.** Ніде в GDScript
   не публікувався `AttachmentJunction`; `crystal_fusion_builder.gd` ховав
   шви заляганням і декоративним коміром, а не trim/класифікацією граней.
   Візуальна перевірка живого білда це підтвердила: під кількома кутами
   видно наскрізні відрізані «денця» дочірніх кристалів крізь стінку
   материнського — саме те, що профіль явно називає неприйнятним.
4. **Вага без користі.** Production wasm-білд важить 9.7 МБ навіть у gzip
   (плюс pck/js) — це чисто додаткове навантаження, оскільки Three.js/R3F і
   так є оплаченою залежністю застосунку (той самий стек паралельно
   використовує риф, `src/features/home/reef3d/`). Сумарна складність
   3D-стеку від Godot не падала, а росла.
5. **CI/інфраструктура.** 4 окремі workflow (~1660 рядків) і `deploy.yml`
   тягли ~1 ГБ движка й export templates із зовнішнього object storage на
   кожен запуск — зовнішня точка відмови поза GitHub, не пов'язана з кодом
   застосунку.
6. **Візуальний результат не кращий за наявний.** Клас багів, знайдений у
   Godot-порту (видимі денця, «левітуюча» тінь без AO), — саме те, що
   TS/Three-пайплайн тими ж днями явно фіксив (`aaf24fd: remove invisible
   mother cap`, `db953a6: preserve exposed crystal tips during trim`).

## Рішення

Повністю видалити Godot-рушій і його інфраструктуру, повернувши
Three.js/R3F (`src/features/home/crystal3d/`) єдиним рендерером кристала:

- видалено `godot/evolution-engine/` (GDScript-проєкт), `e2e/godot/`,
  `src/features/home/godot3d/` (міст, feature flag, rollout/release control,
  device acceptance), `playwright.godot.config.ts`,
  `scripts/generate-godot-release-candidate.mjs`;
- видалено 4 виділені CI workflow і всі Godot-кроки з `deploy.yml`
  (install/import/export движка, manifest-перевірки, rollback-drill);
- видалено `vercel.json` (містив лише Godot cache-headers; Vercel Git
  deploy вже відключений раніше) і Godot-змінні з `.env.local.example`;
- прибрано Godot-специфічні гілки з `vite.config.ts` (workbox runtime
  caching, `navigateFallbackDenylist`, окремий rollup entry для
  `e2e/godot/index.html`);
- `EvolutionCrystalPreviewScene.tsx` спрощено до єдиного шляху рендерингу —
  `<Canvas>` з `EvolutionCrystalObject`, без `resolveEvolutionRenderer`/
  cutover-логіки.

## Альтернативи

**Залишити на ramp-50% і написати ADR заднім числом.** Відхилено: сам ADR не
усунув би дублювання логіки, відсутність `AttachmentJunction` чи вагу білда —
він би лише задокументував рішення, обґрунтування якого не витримує
порівняння з наявним TS+Three рішенням.

**Відкотити rollout до 0% (kill switch), лишивши код.** Відхилено: мертвий
код і CI, що тягне ~1 ГБ на кожен запуск, — це той самий тягар без
production-ризику, тільки прихований. Раз рішення не виправдане, код має
піти, а не залягти вимкненим.

**Домалювати junction-trim і зменшити рушій, лишивши Godot.** Відхилено
власником: продукту не потрібен другий рушій, коли перший (TS+Three) уже
розв'язує ту саму задачу в межах наявної архітектури й активно
допрацьовується (`fix(crystal-geometry)`, `fix(crystal-growth)`).

## Наслідки

**Добре:**
- єдиний рушій кристала — TS `src/engine/` + Three.js/R3F, без мосту й без
  розбіжності канонічного стану;
- production payload кристала падає з ~10 МБ (gzip wasm) до того, що вже
  оплачено рифом (Three.js/R3F);
- CI спрощується: `deploy.yml` — звичайний Vite build + GitHub Pages, без
  зовнішньої залежності від Godot object storage;
- typecheck (`tsc --noEmit`), 814 unit-тестів (`vitest run`) і production
  build пройдені після видалення без змін поза перерахованими файлами.

**Ціна:**
- робота Phase 1–15 (~5 000 рядків GDScript, CI-інфраструктура canary)
  видалена без збереження в `main`; повна історія лишається в git log до
  цього коміту й у попередніх PR.
- якщо в майбутньому з'явиться реальна причина для нативного рушія
  (наприклад, нативний мобільний застосунок), рішення потрібно буде
  приймати заново — і одразу з ADR, `AttachmentJunction`-сумісною геометрією
  та доказом канонічної відповідності TS-референсу.

**Міграція:** не потрібна. Опубліковані стани не серіалізують Godot-специфічні
поля в БД; `crystal_wrap` в UI одразу рендерить Three.js-шлях.
