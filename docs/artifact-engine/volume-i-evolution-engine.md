# Artifact Engine Documentation — Volume I: Evolution Engine

## 1. Purpose

Evolution Engine — це центральний рушій симуляції. Його задача — не створювати геометрію. Його задача — **моделювати історію життя**. Він перетворює будь-які дії користувачів на універсальні сили еволюції; саме ці сили потім використовують усі інші рушії.

Він нічого не знає про кристали, дерева, яйця, маскотів, острови чи сузір'я. Для нього існує лише історія.

## 2. Philosophy

Будь-який артефакт є результатом історії. Не події створюють форму — події створюють **умови**. Форма є лише наслідком цих умов.

Тому Evolution Engine працює як природа: не «створи кристал», а «збільшився тиск росту», «накопичилась енергія», «змінився баланс», «змінився напрямок розвитку».

## 3. Main Principle

```
Користувач → Дані → Evolution Event → Evolution Pressure
  → Species Layer → Growth Engine → Composition Engine → Renderer
```

## 4. Responsibilities

- **Формування історії**: що відбулось, коли, чому.
- **Обчислення еволюційного тиску**: Expansion, Memory, Balance, Exploration, Creativity, Harmony, Stability, Curiosity, Care, Growth.
- **Накопичення досвіду**: артефакт пам'ятає не подію, а її наслідок.
- **Часова шкала**: минуле, теперішнє, майбутнє.
- **Причинно-наслідкові зв'язки**: 100 фотографій не означають 100 кристалів — вони означають великий тиск полірування.

## 5. What it NEVER does

Ніколи не: генерує геометрію, малює, обирає матеріали, створює шейдери, вирішує форму, вирішує колір, створює анімацію.

## 6. Input

Абсолютно всі модулі сайту: фото, подорожі, спогади, досягнення, бажання, фільми, книги, рецепти, цілі, дати, календар, фінанси — і будь-який майбутній модуль.

## 7. Evolution Events

Усе переводиться до одного формату:

```ts
EvolutionEvent { id; timestamp; source; category; intensity; metadata }
```

Наприклад: Photo Added, Place Visited, Goal Completed, Memory Created, Wish Fulfilled, Movie Watched, Recipe Cooked.

## 8. Evolution Timeline

Усі події сортуються. Артефакт ніколи не бачить майбутнього — він росте тільки по історії.

## 9. Evolution Memory

Найважливіша система: артефакт пам'ятає, що, коли і чому змінилось. Вона базується на реальних timestamp у БД. Жодного окремого save-файлу не потрібно.

## 10. Evolution Pressure

Події не ростять форму — вони створюють сили: Фото → Polishing+, Подорож → Expansion+, Спогади → Inner Glow+, Досягнення → Stability+, Бажання → Luminosity+, Цілі → Structure+. Ці сили накопичуються; саме вони керують ростом.

## 11. Pressure Solver

Усі сили нормалізуються (0..1). Species Layer працює саме з ними.

## 12. Determinism

При однакових даних артефакт завжди виглядає однаково. 100%.

## 13. Historical Growth

Нові події не перебудовують історію — вони лише додають новий шар.

## 14. Future Compatibility

Будь-який новий модуль підключається лише створенням нового Evolution Event. Evolution Engine не потрібно змінювати.

## 15. Output

Evolution Timeline, Evolution Events, Evolution Memory, Evolution Pressures, Historical State.

---

## Додаток: Реалізація в кодовій базі

| Розділ специфікації | Код |
|---|---|
| Evolution Event / Timeline (§7-8) | `src/features/home/artifact/evolution/evolutionTypes.ts`, `evolutionEvents.ts::buildEvolutionTimeline` |
| Evolution Memory (§9) | `EvolutionEvent.ageDays` — завжди з реальних дат БД (`daysBetween`), жодного save-файлу |
| Pressure Solver, канонічні сили (§10-11) | `evolution/pressureSolver.ts::solveForces` (10 нормалізованих сил) |
| Historical State / «ніколи не бачить майбутнього» (§8, 15) | `pressureSolver.ts::historyAt(timeline, ageDays)` — рахунки лише «не молодших» подій |
| Species Layer (кристал) | `artifact/evolutionPressure.ts` (проєкція тисків у словник кристала), `artifact/growthEvents.ts` (події відкладення), `artifact/growthField.ts` (історичне ймовірнісне поле) |
| Growth Engine | `artifact/mineralDeposition.ts` (+ `growthSurface.ts`) — геологічна симуляція відкладення |
| Composition Engine | `artifact/composition/` (framework/mineralPreset/score) — фінальний художній шар |
| Renderer | `crystal3d/` (Three.js-адаптер; єдине місце, де існують меши й матеріали) |
| Determinism (§12) | Реєстр seed-офсетів (`mineralDeposition.ts`), фіксовані draw-потоки, тести `__tests__/` |
| Historical Growth (§13) | Політика стрімів/гейтингу у `growthEvents.ts` + історичне поле `placementFieldAt` |
