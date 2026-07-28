// ============================================================
// Чисті правила нагадувань: кому слати й що саме написати.
// ------------------------------------------------------------
// Окремим модулем від index.ts свідомо: той на верхньому рівні
// створює клієнт Supabase і піднімає сервер, тож імпортувати його з
// тесту неможливо — а крон не має способу «спробувати», він або
// мовчить, або надсилає повідомлення обом партнерам у Telegram.
// Тут же немає жодного побічного ефекту, і кожне правило перевіряється
// тестом (index.test.ts), а не вірою.
// ============================================================

// ── Текст нагадування залежно від відстані ───────────────────
/**
 * `partnerName` — ім'я того, ЧИЙ це день народження, коли подія
 * прив'язана до людини з застосунку (`events.person_user_id`) і читач —
 * не вона. Тоді підказка стає конкретною: сенс триденного попередження
 * саме в подарунку, а не в абстрактному «плануй заздалегідь».
 */
export function buildText(
  ev: { title: string; description: string | null },
  displayDate: string,
  kind: "today" | "tomorrow" | "in3days",
  partnerName: string | null,
): string {
  const desc = ev.description ? `\n💬 ${ev.description}` : "";
  const title = ev.title || "Подія";

  switch (kind) {
    case "today":
      return `🔴 <b>СЬОГОДНІ — «${title}»</b>\n`
        + (partnerName ? `📌 Привітай ${partnerName}!` : "📌 Не пропусти!") + desc;
    case "tomorrow":
      return `⚠️ <b>Завтра (${displayDate}) — «${title}»</b>\n`
        + (partnerName ? "🎁 Подарунок уже готовий?" : "🎯 Підготуйся заздалегідь") + desc;
    case "in3days":
      return `⏰ <b>Через 3 дні (${displayDate}) — «${title}»</b>\n`
        + (partnerName ? "🎁 Час подбати про подарунок" : "📋 Плануй заздалегідь") + desc;
  }
}

/**
 * Знахідний відмінок імені — «Привітай Лєну», а не «Привітай Лєна».
 *
 * Словник, а не правила відмінювання: імен у застосунку рівно два, і
 * писати для них морфологію означало б винайти спосіб помилятись.
 * Незнайоме ім'я лишається як є — краще незграбно, ніж неправильно.
 */
export const ACCUSATIVE: Record<string, string> = { "Лєна": "Лєну", "Діма": "Діму" };

// ── Плани ────────────────────────────────────────────────────
/**
 * Плани переїхали з `events` (`type='other'` + JSONB metadata) у власну
 * таблицю `plans`. Крон мусить читати їх звідти — інакше нагадування про
 * них просто перестали б надходити, і помітили б це аж тоді, коли
 * пропустили б виїзд.
 */
export interface PlanRemindable {
  title: string;
  description: string | null;
  start_date: string | null;
  /** 'day' | 'range' | 'month' | 'season' | 'year' | 'none' */
  date_precision: string;
  /** 'idea' | 'planning' | 'preparing' | 'ready' | 'done' | 'postponed' | 'cancelled' */
  status: string;
  confirmed: boolean;
}

/** Статуси, за яких план більше не в роботі. Дзеркало `PLAN_STATUSES[].closed`
 *  у `src/features/plans/planConstants.ts` — edge-функція не імпортує з `src/`,
 *  тож міняти набір треба в обох місцях. */
const CLOSED_STATUSES = ["done", "postponed", "cancelled"];

/**
 * Чи нагадувати про цей план сьогодні, і як саме.
 *
 * Три відсіювання, кожне зі своєї причини:
 *
 * • неточна дата — «через 3 дні» під планом «осінь 2026» обіцяло б
 *   знання, якого немає: 1 вересня там стоїть лише як початок періоду;
 * • закритий статус — виконаний, відкладений чи скасований план не має
 *   нагадувати про себе (це те саме правило, що колись робив `isDonePlan`
 *   по JSONB, лише тепер у явному полі);
 * • непідтверджена пропозиція — це ще питання до партнера, а не спільний
 *   план. «Завтра — Львів» про те, на що ще не погодились, було б
 *   неправдою.
 *
 * Нагадуємо про ПОЧАТОК: кінець періоду нікого не застає зненацька.
 */
export function planReminderKind(
  plan: PlanRemindable,
  dates: { today: string; plus1: string; plus3: string },
): "today" | "tomorrow" | "in3days" | null {
  if (!plan.start_date) return null;
  if (plan.date_precision !== "day" && plan.date_precision !== "range") return null;
  if (CLOSED_STATUSES.includes(plan.status)) return null;
  if (!plan.confirmed) return null;

  if (plan.start_date === dates.today) return "today";
  if (plan.start_date === dates.plus1) return "tomorrow";
  if (plan.start_date === dates.plus3) return "in3days";
  return null;
}

export interface Recipient { id: number; name: string; chat_id: string | number }

/**
 * Кому й з яким іменем іде нагадування про цю подію.
 *
 * Винесено з циклу окремою чистою функцією саме тому, що правило
 * перестало бути «усім однаково»: воно має власні крайні випадки
 * (подія без прив'язки, прив'язка до людини поза парою, річниця
 * замість дня народження), і кожен із них перевіряється тестом, а не
 * вірою.
 *
 * `personName` — ім'я іменинника у знахідному, або null коли підказка
 * має лишитись загальною.
 */
export function reminderTargets(
  ev: { type?: string | null; person_user_id?: number | null },
  recipients: readonly Recipient[],
): Array<{ recipient: Recipient; personName: string | null }> {
  const personId = ev.person_user_id ?? null;
  const out: Array<{ recipient: Recipient; personName: string | null }> = [];

  for (const r of recipients) {
    // Нагадувати людині про ЇЇ ВЛАСНИЙ день народження — шум, і до того
    // ж воно видає, що партнера підштовхують з подарунком. Інші типи
    // (річниці) стосуються обох, тож ідуть як є.
    if (ev.type === "birthday" && personId === r.id) continue;

    const person = personId !== null && personId !== r.id
      ? recipients.find((u) => u.id === personId)
      : undefined;
    out.push({
      recipient: r,
      personName: person ? (ACCUSATIVE[person.name] ?? person.name) : null,
    });
  }
  return out;
}
