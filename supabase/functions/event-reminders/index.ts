// ============================================================
// Supabase Edge Function: event-reminders
// Запускається щодня о 8:00 за Київським часом (05:00 UTC)
// через pg_cron (SQL нижче у CHANGES_SWR.md / README).
//
// ЄДИНИЙ крон нагадувань про події (daily-reminder — видалити,
// він дублював сповіщення для частини подій).
// Перевіряє ВСІ події з таблиці events і надсилає нагадування
// в Telegram усім користувачам:
//   • за 3 дні  — «Через 3 дні…»
//   • за 1 день — «Завтра…»
//   • в день    — «🔴 СЬОГОДНІ: …»
//
// Підтримує yearly-події (щорічні): порівнює лише MM-DD.
//
// Якщо подія прив'язана до людини з застосунку (events.person_user_id),
// текст різний для двох читачів: партнер отримує підказку про подарунок
// з іменем, а сама іменинниця/іменинник — нічого. Без прив'язки (дні
// народження батьків, друзів, усі річниці) обоє отримують те саме, що
// й раніше.
//
// Крім подій перевіряються ПЛАНИ з таблиці `plans`. Раніше вони жили в
// `events` як `type='other'`; після переїзду цей крон мовчки перестав би
// про них нагадувати — найтихіша з можливих поломок, бо помітна лише
// тоді, коли вже пропустив виїзд.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildText, planReminderKind, reminderTargets } from "./reminderRules.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Утиліти дат ───────────────────────────────────────────────
function toUTCDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function fmtDateUA(dateStr: string): string {
  const MONTHS = [
    "січня","лютого","березня","квітня","травня","червня",
    "липня","серпня","вересня","жовтня","листопада","грудня",
  ];
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * 'MM-DD' щорічної події, як вона випадає в конкретному році.
 *
 * Навіщо: звірка сирих 'MM-DD' означала, що подія 29 лютого не збігається
 * ні з чим три роки з чотирьох — нагадування про неї просто НЕ приходило.
 * Конвенція та сама, що в застосунку: останній день того самого місяця,
 * тобто 28 лютого. Правило продубльоване в
 * `src/features/calendar/calendarUtils.ts::sameDayInYear`; edge-функція не
 * імпортує з `src/`, тож міняти конвенцію треба в обох місцях.
 */
function yearlyMD(evMD: string, year: number): string {
  const [month, day] = evMD.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(month).padStart(2, "0")}-${String(Math.min(day, daysInMonth)).padStart(2, "0")}`;
}

// ── Telegram ──────────────────────────────────────────────────
async function sendTelegram(chatId: string | number, text: string): Promise<void> {
  const token = Deno.env.get("TG_BOT_TOKEN");
  if (!token) { console.warn("TG_BOT_TOKEN не встановлено"); return; }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) console.error("Telegram error:", await res.text());
}

// ── Головний обробник ─────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── Поточна дата (UTC, Supabase зберігає дати без часу) ──
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const todayStr = toUTCDateStr(now);
    const plus1Str = toUTCDateStr(addDays(now, 1));
    const plus3Str = toUTCDateStr(addDays(now, 3));

    // month-day для щорічних подій
    const todayMD = todayStr.slice(5);  // "MM-DD"
    const plus1MD = plus1Str.slice(5);
    const plus3MD = plus3Str.slice(5);

    // ── Завантажуємо події ────────────────────────────────────
    // `type='other'` НЕ беремо: такі рядки були планами, і тепер плани
    // читаються з власної таблиці нижче. Без цього фільтра нагадування
    // про перенесений план приходило б двічі — те саме дублювання, через
    // яке колись видалили крон daily-reminder.
    const { data: events, error: evErr } = await sb
      .from("events")
      .select("id,title,description,date,yearly,type,person_user_id")
      .neq("type", "other");

    if (evErr) throw evErr;
    const toCheck = events || [];

    // ── Завантажуємо плани ────────────────────────────────────
    // Порожній список планів — не привід мовчати про події, тому помилку
    // тут лише логуємо: половина нагадувань краща за жодного.
    const { data: plansData, error: planErr } = await sb
      .from("plans")
      .select("id,title,description,start_date,date_precision,status,confirmed");
    if (planErr) console.error("plans read failed:", planErr);
    const plans = plansData || [];

    // ── Отримуємо отримувачів ─────────────────────────────────
    const { data: users } = await sb
      .from("users")
      .select("id,name,chat_id");
    const recipients = (users || []).filter((u: any) => u.chat_id);

    if (!recipients.length) {
      return new Response(
        JSON.stringify({
          skipped: "no_recipients",
          events_found: toCheck.length,
          plans_found: plans.length,
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // ── Перевіряємо кожну подію ───────────────────────────────
    const results: string[] = [];
    // Лічимо ПОВІДОМЛЕННЯ окремо від подій: з появою персоналізації
    // подія більше не означає рівно два повідомлення.
    let messages = 0;
    let skippedSelf = 0;

    for (const ev of toCheck) {
      const evDate: string = ev.date;       // "YYYY-MM-DD"
      const evMD:   string = evDate.slice(5); // "MM-DD"
      const isYearly: boolean = !!ev.yearly;

      let kind: "today" | "tomorrow" | "in3days" | null = null;
      let displayDate = "";

      if (isYearly) {
        // Щорічна подія: порівнюємо тільки місяць і день, але дату події
        // спершу проєктуємо на ЦІЛЬОВИЙ рік — інакше 29 лютого не
        // збігається ні з чим (див. yearlyMD).
        const inYear = (s: string) => yearlyMD(evMD, Number(s.slice(0, 4)));
        if      (inYear(todayStr) === todayMD) { kind = "today";   displayDate = fmtDateUA(todayStr); }
        else if (inYear(plus1Str) === plus1MD) { kind = "tomorrow"; displayDate = fmtDateUA(plus1Str); }
        else if (inYear(plus3Str) === plus3MD) { kind = "in3days";  displayDate = fmtDateUA(plus3Str); }
      } else {
        // Разова подія: точна дата
        if      (evDate === todayStr) { kind = "today";   displayDate = fmtDateUA(evDate); }
        else if (evDate === plus1Str) { kind = "tomorrow"; displayDate = fmtDateUA(evDate); }
        else if (evDate === plus3Str) { kind = "in3days";  displayDate = fmtDateUA(evDate); }
      }

      if (!kind) continue; // ця подія сьогодні не нагадується

      const targets = reminderTargets(ev, recipients);
      skippedSelf += recipients.length - targets.length;

      for (const t of targets) {
        await sendTelegram(t.recipient.chat_id, buildText(ev, displayDate, kind, t.personName));
        messages += 1;
      }

      results.push(`${kind}:${ev.title}`);
    }

    // ── Перевіряємо кожен план ────────────────────────────────
    // Плани не бувають щорічними й не прив'язані до людини, тож усе
    // правило — в одній чистій функції, а тут лишається сама розсилка.
    for (const plan of plans) {
      const kind = planReminderKind(plan as any, {
        today: todayStr, plus1: plus1Str, plus3: plus3Str,
      });
      if (!kind) continue;

      const displayDate = fmtDateUA(plan.start_date as string);
      for (const t of reminderTargets({}, recipients)) {
        await sendTelegram(t.recipient.chat_id, buildText(plan as any, displayDate, kind, null));
        messages += 1;
      }
      results.push(`${kind}:план ${plan.title}`);
    }

    console.log("event-reminders done:", results);

    return new Response(
      JSON.stringify({
        sent: results.length,
        messages,
        skipped_self: skippedSelf,
        reminders: results,
        events_checked: toCheck.length,
        plans_checked: plans.length,
        recipients: recipients.length,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("event-reminders error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
