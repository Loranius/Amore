# ADR-0200 — Спогади були відкриті кожному, хто має публічний ключ

- **Статус:** Accepted
- **Дата:** 2026-09-21
- **Зачіпає:** `supabase/migrations/20260921093000_memories_sync_source_revoke_public.sql`
  (новий), права на `public.memories_sync_source` у робочій базі,
  `docs/PORTAL_AUDIT_2026-09-20.md`, `docs/MODULE_STATUS.md`
- **Тип зміни за `CHANGE_CONTROL_AND_ADR.md`:** закриття знайденої аудитом
  вади доступу
- **Вказівка власника:** «Роби ревок меморіс сінк соурс»

## §1 Що було відкрито

`public.memories_sync_source(text, date, text, integer, text, bigint)` —
`SECURITY DEFINER`, і EXECUTE на ній мали `PUBLIC`, `anon` та
`authenticated`. Права до зміни:

```
{=X/postgres, postgres=X/postgres, anon=X/postgres,
 authenticated=X/postgres, service_role=X/postgres}
```

Усередині немає **жодної** перевірки особи — ні `auth.uid()`, ні пари:

```sql
insert into public.memories (photo_url, memory_date, date_precision, caption, uploaded_by)
values (p_photo_url, coalesce(p_date, current_date), 'day', p_caption, p_author)
```

`p_author` — звичайний аргумент, який називає викликач. А на порожньому
`p_photo_url` функція натомість **видаляє** рядки з `public.memory_links`.

`anon`-ключ лежить у зібраному PWA — так і має бути, він публічний. Тобто
будь-хто, хто відкрив сайт, мав усе потрібне, щоб звернутись до
`/rest/v1/rpc/memories_sync_source` і дописати або видалити щось у спогадах
пари.

## §2 Це не помилка, яку хтось зробив

Міграція, що створила функцію (`20260727140000_memories_sources.sql`), не
містить **жодного** `grant`. EXECUTE для `PUBLIC` ставить сам PostgreSQL
при `create function`, а явні права `anon`/`authenticated` приходять із
типових привілеїв Supabase на схему `public`.

Ніхто не відчиняв дверей — їх просто не зачинили. Це різниця, яка важить:
шукати винного тут нема де, а шукати **інші такі самі двері** — є.

## §3 Що саме зроблено

```sql
revoke execute on function
  public.memories_sync_source(text, date, text, integer, text, bigint)
  from public, anon, authenticated;
```

Права після зміни: `{postgres=X/postgres, service_role=X/postgres}`.

**Функцію не чіпали, лише права.** Вона задумана як внутрішня: її кличуть
тригери `memories_from_map_pin` і `memories_from_gift_completion` — і
тільки вони (перевірено `grep` по `src/` та `supabase/functions/`: жодного
виклику). Обидва тригери самі `SECURITY DEFINER` і належать `postgres`,
тож усередині них `current_user` = postgres, і право postgres лишається.

**`service_role` лишено навмисно.** Це повноважний серверний ключ, який і
так пише в `memories` напряму, оминаючи RLS. Забрати в нього EXECUTE —
нічого не додати до безпеки й дати собі шанс зламати майбутню
Edge-функцію.

Міграція має власні запобіжники: відмовляється застосовуватись, якщо
функції або тригерів немає, і після `revoke` сама перевіряє, що
`anon`/`authenticated` втратили право, а `postgres` його зберіг.

## §4 Як перевірено

Усе — в транзакціях із `rollback`, тому дані пари не змінились: до й після
проб у базі рівно **61 спогад, 27 пінів, 21 зв'язок**, сміття з проб — нуль.

**1. Права.**

| роль | до | після |
|---|---|---|
| `PUBLIC` | ✔ | **—** |
| `anon` | ✔ | **—** |
| `authenticated` | ✔ | **—** |
| `service_role` | ✔ | ✔ |
| `postgres` | ✔ | ✔ |

**2. Відмова замість виклику.** Під `SET LOCAL ROLE anon` і під
`authenticated` прямий `PERFORM public.memories_sync_source(…)` дає
`insufficient_privilege`. Перевірка написана так, що успішний виклик
підняв би виняток «ПРОВАЛ» — тобто мовчазного проходу бути не може.

**3. Тригер працює далі.** Той самий вимір до й після зміни: вставка в
`map_pins` під роллю `authenticated` з фото й датою →

| коли | створено спогадів | створено зв'язків |
|---|---|---|
| до ревоку | 1 | 1 |
| **після ревоку** | **1** | **1** |

**4. Радник більше її не бачить.** Серед `SECURITY DEFINER` функцій
схеми `public`, доступних `anon`, лишились шість, і жодна не є вадою:
два `finance_*` першим рядком кличуть `finance_current_user_id_v1()`, яка
кидає `finance_user_not_linked` без сесії, а чотири решта мають
`RETURNS trigger` — PostgREST таких як RPC не показує.

## §5 Названі межі

1. **Шлях «подарунок → спогад» не перевірявся вставкою.** Другий тригер,
   `memories_from_gift_completion`, ділить із перевіреним ту саму
   механіку (SECURITY DEFINER, власник `postgres`), і цього достатньо для
   висновку. Вставляти несправжнє виконання подарунка не стали свідомо:
   в базі стоїть `pg_net` і Edge-функція `db-notify`, тож така проба
   могла б надіслати парі справжнє сповіщення — а `rollback` HTTP-запит
   уже не відкличе.
2. **Типові привілеї схеми не змінено.** `alter default privileges …
   revoke execute on functions from public` зачинило б ці двері для ВСІХ
   майбутніх функцій одразу. Це помітно ширша зміна з власною ціною, і
   робити її тим самим рухом, що й точковий `revoke`, було б підміною
   задачі. Названо як окреме рішення на потім.
3. **Решта поверхні RPC не переглядалась цією зміною.** Аудит окремо
   назвав двадцять п'ять `finance_*` — точки входу модуля, видаленого в
   ADR-0049 (`PORTAL_AUDIT_2026-09-20.md` §3.2). Вони не небезпечні, але
   це мертва поверхня, і вона лишається.
4. **Міграція застосована до робочої бази напряму** (`apply_migration`),
   а не через `supabase db push`. Файл у `supabase/migrations/` описує
   рівно те саме й існує, щоб зміна не була невидимою для репозиторію;
   повторне застосування безпечне — `revoke` ідемпотентний, а запобіжники
   лише читають.
