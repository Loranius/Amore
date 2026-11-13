# Модуль «Цикл» — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Модуль `/cycle` для пари 1: вона один раз вносить цикл, він бачить фазу, прогноз і пораду дня з кнопкою «У покупки»; за день до початку — нагадування йому в Telegram.

**Architecture:** Чиста детермінована модель (`cycleModel.ts`) і заготовлені поради (`cycleAdvice.ts`) без React; одна таблиця Supabase `cycle_settings` з `couple_id`; сторінка читає стать обох членів пари з `users.gender` і показує екран «він» або «вона». Доступ — як у гри (ADR-0236). Нагадування — нове правило в `event-reminders`, формула дубльована в Deno-файлі без імпортів і звірена тестом.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Supabase (Postgres + RLS, Edge Functions на Deno), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-cycle-module-design.md`

## Global Constraints

- Лише пара 1: `coupleId === 1`; інші пари не бачать пункту, `/cycle` → `/`.
- Жодного впливу на кристал: нічого з модуля не імпортується в `src/features/home/**` чи `src/engine/**`.
- Без `Math.random` і без імпорту `@/lib/entropy` у `cycleModel.ts`/`cycleAdvice.ts`; «сьогодні» передається параметром (`todayISO()` з `@/lib/utils` викликає лише UI).
- `cycle_length` 21–45 (за замовчуванням 28), `period_length` 2–10 (за замовчуванням 5), `last_start` не в майбутньому.
- Овуляція — день `cycle_length − 14`; вікно овуляції `−2…+1`; ПМС — останні 5 днів; пріоритет: Місячні > ПМС > Овуляція > решта.
- Назви фаз на екрані: «Місячні», «Після місячних», «Овуляція», «Після овуляції», «ПМС».
- Пише лише вона (`user_id` = поточний, `gender = 'female'`); він лише читає.
- Порад їй не показуємо; нагадування — лише йому, лише за день до прогнозованого початку.
- Ім'я партнерки — з профілю (`usePartner().displayName`), не зашите.
- Під календарем рядок: «Це прогноз за середнім циклом, не медична порада й не захист».
- UI за `DESIGN.md` (Two Accents, Rare Colour, Fredoka Restraint, Shadow Is A Shadow, One Blur) і `amore-frontend-craft`; телефон 412×915.
- Тексти порад власник затверджує в чаті **до** пушу в `main`.

## Review Focus

1. Прогноз через кілька циклів без натискань (`last_start` півроку тому) — фаза й дата наступних мають бути правильні, а не «день 183». → Task 1, тест `rolls forward many cycles`.
2. `today < last_start` (вона ввела дату з помилкою або годинник телефону відстає) — без від'ємного дня; трактуємо як день 1. → Task 1, тест `future last_start clamps to day 1`.
3. Короткий цикл 21 з місячними 10 днів — фази перекриваються; пріоритет має дати рівно одну фазу на день і жодного дня без фази. → Task 1, тест `every day has exactly one phase for all lengths`.
4. Він відкрив модуль, коли вона ще нічого не внесла, або зв'язок з базою впав — заглушка/помилка, а не порожній екран чи вигадані дані. → Task 5, тест `viewModel: no settings → empty state`.
5. Нагадування: межа Київ/UTC і кінець місяця/року (наступні 1 січня). → Task 6, тест паритету на датах `2026-12-31`/`2027-01-01`.

---

### Task 1: Модель циклу

**Files:**
- Create: `src/features/cycle/cycleModel.ts`
- Test: `src/features/cycle/cycleModel.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CyclePhase = 'period' | 'follicular' | 'ovulation' | 'luteal' | 'pms';
  export const PHASE_LABEL: Record<CyclePhase, string>; // назви з Global Constraints
  export interface CycleInput { lastStart: string; cycleLength: number; periodLength: number } // ISO-дати
  export interface CycleToday { day: number; phase: CyclePhase; nextStart: string; daysUntilNext: number; ovulationDay: number }
  export function phaseOfDay(day: number, cycleLength: number, periodLength: number): CyclePhase;
  export function cycleToday(input: CycleInput, today: string): CycleToday;
  export function monthMarks(input: CycleInput, year: number, month: number /*1–12*/): Array<{ date: string; phase: CyclePhase }>;
  export const CYCLE_LIMITS: { cycle: { min: 21; max: 45; default: 28 }; period: { min: 2; max: 10; default: 5 } };
  export function validateCycleInput(input: CycleInput, today: string): string | null; // текст помилки українською або null
  ```

- [ ] **Step 1: Write the failing tests** (`cycleModel.test.ts`):
  - `phaseOfDay`: для 28/5 — дні 1–5 `period`, 6–11 `follicular`, 12–15 `ovulation` (овуляція 14: 12…15), 16–23 `luteal`, 24–28 `pms`.
  - `every day has exactly one phase for all lengths`: для всіх `cycle` 21…45 × `period` 2…10 кожен день 1…cycle дає фазу; день 1 завжди `period`; останній день — `pms`, якщо `period < cycle − 4`.
  - `cycleToday({lastStart:'2026-11-01',cycleLength:28,periodLength:5}, '2026-11-01')` → `{day:1, phase:'period', nextStart:'2026-11-29', daysUntilNext:28}`.
  - `rolls forward many cycles`: `lastStart '2026-05-01'`, 28, today `'2026-11-13'` → `day` = ((196) mod 28)+1 = 1, `nextStart '2026-12-11'`.
  - `future last_start clamps to day 1`: today раніше за lastStart → `day 1`, `nextStart = lastStart + cycleLength`.
  - Перехід року: lastStart `'2026-12-10'`, 28 → `nextStart '2027-01-07'`.
  - `monthMarks(...,2026,11)` має 30 записів, дати по порядку.
  - `validateCycleInput`: 20 і 46 днів циклу, 1 і 11 днів місячних, дата в майбутньому → не `null`; 28/5/минула дата → `null`.

- [ ] **Step 2: Run** `npx vitest run src/features/cycle/cycleModel.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** у `cycleModel.ts`. Дати — лише через UTC-полудень (`Date.UTC(y,m-1,d)` і ділення на 86 400 000), щоб літній час не зсував різницю днів; жодного `new Date()` без аргументу.

- [ ] **Step 4: Run** той самий тест — Expected: PASS.

- [ ] **Step 5: Commit** `feat(cycle): модель фаз циклу`.

---

### Task 2: Поради дня

**Files:**
- Create: `src/features/cycle/cycleAdvice.ts`
- Test: `src/features/cycle/cycleAdvice.test.ts`

**Interfaces:**
- Consumes: `CyclePhase` (Task 1).
- Produces:
  ```ts
  export interface Sweet { title: string } // те, що піде в Покупки
  export interface PhaseAdvice { behave: readonly string[]; todo: readonly string[]; sweets: readonly Sweet[] }
  export const CYCLE_ADVICE: Record<CyclePhase, PhaseAdvice>;
  export interface DailyAdvice { behave: string; todo: string; sweet: Sweet }
  export function adviceFor(phase: CyclePhase, today: string): DailyAdvice;
  ```

- [ ] **Step 1: Write the failing tests:** кожна фаза має 5–8 пунктів у кожному списку; жоден пункт не порожній і не повторюється в межах фази; `adviceFor('pms','2026-11-13')` двічі дає однаковий результат; для 30 днів поспіль у фазі `luteal` трапляється щонайменше 3 різні `behave` (вибір не застряг на одному).

- [ ] **Step 2: Run** `npx vitest run src/features/cycle/cycleAdvice.test.ts` — FAIL.

- [ ] **Step 3: Implement.** Вибір: FNV-1a 32-біт від рядка `` `${today}|${phase}|behave` `` (і `|todo`, `|sweet` — різні солі, щоб три частини не мінялись синхронно), модуль довжини списку. Тексти — тепло, без зверхності й жартів про ПМС (антицілі специфікації); солодке — конкретні назви, як на полиці («Чорний шоколад з горіхами», «Морозиво пломбір»).

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(cycle): поради дня за фазою`.

---

### Task 3: Таблиця, типи й доступ до даних

**Files:**
- Create: `supabase/migrations/20261113120000_cycle_settings.sql`
- Modify: `src/types/index.ts` (рядок типу біля `UserSizesRow` ~363; запис у `Database.Tables` біля `user_sizes` ~585; `gender` у `UsersRow` ~226 як `'male' | 'female' | null`)
- Modify: `src/lib/queryKeys.ts` (поруч із `userSizes`, ~73)
- Create: `src/features/cycle/useCycle.ts`
- Modify: `supabase/tests/portal_membership_gate.sql` (перевірка, що чужий не бачить `cycle_settings`)

**Interfaces:**
- Produces:
  ```ts
  export interface CycleSettingsRow { user_id: number; couple_id: number; last_start: string; cycle_length: number; period_length: number; updated_at: string }
  qk.cycleSettings(): readonly ['cycleSettings']
  qk.coupleGenders(): readonly ['coupleGenders']
  export function useCoupleGenders(): { her: number | null; him: number | null; isPending: boolean } // з users.select('id,gender')
  export function useCycleSettings(herId: number | null): UseQueryResult<CycleSettingsRow | null>
  export function useSaveCycle(): UseMutationResult<void, Error, { user_id: number; last_start: string; cycle_length: number; period_length: number }>
  ```
  `her`/`him` — `null`, якщо в парі немає рівно однієї жінки й одного чоловіка.

- [ ] **Step 1: Write the migration.** Таблиця з полями зі специфікації; `check (cycle_length between 21 and 45)`, `check (period_length between 2 and 10)`; `couple_id bigint not null default public.current_couple_id() references public.couples(id) on delete cascade`; `user_id` PK, FK на `users(id)`; `enable row level security`; політика `couple_scope` restrictive (точно як у `20260929090000_couple_isolation_a.sql` §4); permissive `select` для `authenticated` у межах пари; `insert`/`update` лише `user_id = current_portal_user_id()` (взяти функцію, яку вже використовують політики `user_sizes` — знайти `grep -n "user_sizes" supabase/migrations`) і `exists (select 1 from users where id = user_id and gender = 'female')`; без `delete`.

- [ ] **Step 2: Додати перевірку в `portal_membership_gate.sql`:** не-член бачить 0 рядків `cycle_settings`; чоловік пари не може `update`. Run: `npm run test:db` — Expected: PASS (якщо локальний Postgres недоступний у пісочниці — записати це в звіт, не пропускати мовчки).

- [ ] **Step 3: Типи, ключі запитів і `useCycle.ts`** за зразком `src/features/sizes/useSizes.ts` (upsert по `user_id`; тост «Цикл збережено» / «Не вдалося зберегти цикл»).

- [ ] **Step 4: Run** `npm run typecheck` — Expected: 0 помилок.

- [ ] **Step 5: Commit** `feat(cycle): таблиця cycle_settings і хуки`. **Не застосовувати міграцію до живої бази** — це робиться в Task 7 за згодою власника.

---

### Task 4: Доступ лише для пари 1 і пункт меню

**Files:**
- Create: `src/features/cycle/cycleAccess.ts`, `src/features/cycle/CycleGate.tsx`
- Modify: `src/features/game/gameAccess.ts` (`visibleNavItems` фільтрує й `/cycle`)
- Modify: `src/app/nav.ts` (група «Часто», ~78–82), `src/app/routes.tsx` (ледаче `loadCycle`, маршрут поруч із `game` ~180)
- Modify: `src/components/icons/NavIcon.tsx` (нова `CycleIcon`, стиль як `RulerIcon`)
- Test: `src/features/cycle/cycleAccess.test.ts`

**Interfaces:**
- Produces: `export const CYCLE_PATH = '/cycle'; export function canSeeCycle(coupleId: number | null | undefined): boolean;` (`=== 1`).

- [ ] **Step 1: Failing tests:** `canSeeCycle(1)` true, `2`/`null` false; `visibleNavItems([{to:'/cycle'},{to:'/sizes'}], 2)` → лише `/sizes`; для `1` — обидва; поки `null` — без `/cycle`.
- [ ] **Step 2: Run** `npx vitest run src/features/cycle/cycleAccess.test.ts` — FAIL.
- [ ] **Step 3: Implement**; `CycleGate` — копія поведінки `GameGate` на `canSeeCycle`. Пункт меню: `{ to: '/cycle', Icon: CycleIcon, label: 'Цикл' }`.
- [ ] **Step 4: Run** тест + `npx vitest run src/features/game src/components/icons` — PASS (зокрема `noEmojiInControls`).
- [ ] **Step 5: Commit** `feat(cycle): пункт меню й маршрут лише для пари 1`.

---

### Task 5: Сторінка

**Files:**
- Create: `src/features/cycle/cycleViewModel.ts`, `CyclePage.tsx`, `CycleHisView.tsx`, `CycleHerView.tsx`, `CycleForm.tsx`, `CycleCalendar.tsx`, `cycle.css`
- Test: `src/features/cycle/cycleViewModel.test.ts`

**Interfaces:**
- Consumes: Task 1–3; `useShoppingMutations().add` з `src/features/shopping/useShoppingItems.ts` (`{ lines: [{ title, qty: null, category: 'Інше' }], notify: false }`); `usePartner()` з `src/features/_shared/useUsers.ts`; `todayISO()` з `@/lib/utils`.
- Produces:
  ```ts
  export type CycleView =
    | { kind: 'loading' }
    | { kind: 'error' }
    | { kind: 'unsupported' }            // немає пари «жінка + чоловік»
    | { kind: 'her-form' }               // вона, даних нема
    | { kind: 'her'; today: CycleToday }
    | { kind: 'his-empty'; partnerName: string }
    | { kind: 'his'; today: CycleToday; advice: DailyAdvice; partnerName: string };
  export function cycleView(args: { meId: number; her: number | null; him: number | null; settings: CycleSettingsRow | null | undefined; pending: boolean; failed: boolean; partnerName: string; today: string }): CycleView;
  ```

- [ ] **Step 1: Failing tests** для `cycleView`: кожна гілка `kind`; `viewModel: no settings → empty state` (він, `settings: null` → `his-empty` з ім'ям); помилка запиту → `error`, а не `his-empty`; вона з даними → `her` без поля `advice`.
- [ ] **Step 2: Run** `npx vitest run src/features/cycle/cycleViewModel.test.ts` — FAIL.
- [ ] **Step 3: Implement** `cycleViewModel.ts`, потім компоненти:
  - **Він:** фаза й «день N з M», «До наступних — N днів (дата)», три рядки поради, «У покупки» біля солодкого (тост «Додано в покупки»), календар, тихий рядок-застереження.
  - **Вона, без даних:** `CycleForm` — дата, довжина циклу, тривалість місячних з `CYCLE_LIMITS.default`; помилка з `validateCycleInput` під полем.
  - **Вона, з даними:** фаза, дата наступних, календар, кнопки «Почались сьогодні» (`last_start = todayISO()`, решта без змін) і «Змінити дані».
  - Заглушки: `his-empty` — «{ім'я} ще не заповнила цикл»; `unsupported` — тихий текст.
- [ ] **Step 4: Run** `npx vitest run src/features/cycle` і `npm run typecheck` — PASS.
- [ ] **Step 5: Live check.** Прочитати `scripts/live/README.md`; `npm run live -- /cycle` за обох членів пари 1 (за потреби — `--seed`), 412×915. Подивитись кадри через Read; записати, що виміряно.
- [ ] **Step 6: Commit** `feat(cycle): сторінка для нього й для неї`.

---

### Task 6: Нагадування в Telegram

**Files:**
- Create: `supabase/functions/event-reminders/cycleRules.ts` (без жодних імпортів)
- Modify: `supabase/functions/event-reminders/index.ts` (після планів, ~217)
- Test: `src/features/cycle/cycleReminderParity.test.ts` (імпортує `../../../supabase/functions/event-reminders/cycleRules`)

**Interfaces:**
- Produces:
  ```ts
  export function cycleStartsTomorrow(lastStart: string, cycleLength: number, today: string): boolean;
  export function cycleReminderText(partnerName: string, startDate: string /*«22 листопада»*/): string;
  ```

- [ ] **Step 1: Failing parity test:** для `cycleLength` 21…45 і 120 днів від `lastStart '2026-11-01'`, а також навколо `2026-12-31`/`2027-01-01`: `cycleStartsTomorrow(...) === (cycleToday(input, today).daysUntilNext === 1)`; текст містить ім'я й дату.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `cycleRules.ts`; в `index.ts` — читати `cycle_settings` (`user_id,couple_id,last_start,cycle_length`) лише для `couple_id = 1`, `users.gender`; надсилати лише чоловікові цієї пари з `chat_id`. «Сьогодні» — київська дата (крон о 05:00 UTC = той самий день у Києві; використати `toUTCDateStr(new Date())` як і решта файлу). Помилку читання — логувати, не зупиняти решту нагадувань.
- [ ] **Step 4: Run** тест — PASS.
- [ ] **Step 5: Commit** `feat(cycle): нагадування йому за день до початку`.

---

### Task 7: Документи, затвердження текстів, випуск

**Files:**
- Create: `docs/05_ADR/ADR-0264-cycle-module.md` (за зразком сусідніх ADR; рішення власника 2026-11-13)
- Modify: `docs/MODULE_STATUS.md` (новий рядок «Цикл | `/cycle` | …», лише пара 1)
- Modify: `docs/superpowers/specs/2026-11-13-cycle-module-design.md` (нічого, якщо реалізація не відступила)

- [ ] **Step 1:** ADR і рядок статусу. Run `python scripts/validate_documentation.py` — PASS.
- [ ] **Step 2:** Run `bash scripts/quality-gate.sh` — PASS (format, lint, typecheck, unit, build).
- [ ] **Step 3:** Показати власнику в чаті всі тексти `CYCLE_ADVICE` і текст Telegram; внести правки.
- [ ] **Step 4:** Спитати власника про застосування міграції до живої бази й деплой `event-reminders`; виконати лише після «так».
- [ ] **Step 5:** Commit, `git push -u origin ccr-976e59a1-kuu333`, після «ок» на тексти — `git push origin HEAD:main`.
- [ ] **Step 6:** Звіт за `docs/06_TEMPLATES/IMPLEMENTATION_REPORT_TEMPLATE.md`.
