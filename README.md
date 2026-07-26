# Amore

PWA-застосунок для пари: спільні спогади, подорожі, бажання, цілі, фінанси — і **Кристал Amore**, живий артефакт на головній, що росте з реальної історії пари.

## Стек

Vite 5 · React 19 · TypeScript (strict) · Tailwind v4 · TanStack Query · Supabase · Three.js / React Three Fiber.

## Команди

```bash
npm install
npm run dev        # локальний дев-сервер
npm run typecheck  # tsc --noEmit
npm test           # vitest (рушій артефакту)
npm run build      # tsc -b && vite build
```

Потрібен `.env.local` (див. `.env.local.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Кристал Amore — Evolution Engine

Кристал не намальований і не випадковий: він детерміновано виростає з історії пари. Той самий seed + ті самі дані завжди дають той самий кристал; нові події **додають** шар, не перебудовуючи минуле.

Конвеєр (нормативна специфікація — SAS v2.1):

```
Evolution Engine → Species Layer → Growth Engine → Composition Framework → Geometry Engine → Material Engine
```

| Шар | Код |
|---|---|
| I Core Simulation / Evolution | `src/features/home/artifact/evolution/` |
| II Species Framework | `src/features/home/artifact/species/` |
| III Growth Engine | `src/features/home/artifact/growth/` |
| IV Composition Framework | `src/features/home/artifact/composition/` |
| V Geometry + VI Material | `src/features/home/crystal3d/` |

## Документація

- [`INDEX.md`](INDEX.md) — покажчик усієї нормативної документації
- [`CLAUDE.md`](CLAUDE.md) — інструкції для Claude Code (нормативні, читати перед змінами коду)
- [`docs/02_VOLUMES/`](docs/02_VOLUMES/) — специфікації волюмів I–VII
- [`docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md`](docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md) — профіль цілісності кріплення кристалів (`CAI-REQ-001..012`)
- [`docs/artifact-engine/`](docs/artifact-engine/) — історичні нотатки про те, як шари лягли на код (не нормативні)
