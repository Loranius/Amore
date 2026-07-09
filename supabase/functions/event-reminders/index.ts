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
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ── Текст нагадування залежно від відстані ───────────────────
function buildText(
  ev: { title: string; description: string | null },
  displayDate: string,
  kind: "today" | "tomorrow" | "in3days",
): string {
  const desc = ev.description ? `\n💬 ${ev.description}` : "";
  const title = ev.title || "Подія";

  switch (kind) {
    case "today":
      return `🔴 <b>СЬОГОДНІ — «${title}»</b>\n📌 Не пропусти!` + desc;
    case "tomorrow":
      return `⚠️ <b>Завтра (${displayDate}) — «${title}»</b>\n🎯 Підготуйся заздалегідь` + desc;
    case "in3days":
      return `⏰ <b>Через 3 дні (${displayDate}) — «${title}»</b>\n📋 Плануй заздалегідь` + desc;
  }
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

    // ── Завантажуємо ВСІ події ────────────────────────────────
    const { data: events, error: evErr } = await sb
      .from("events")
      .select("id,title,description,date,yearly,type");

    if (evErr) throw evErr;
    const toCheck = events || [];

    // ── Отримуємо отримувачів ─────────────────────────────────
    const { data: users } = await sb
      .from("users")
      .select("id,name,chat_id");
    const recipients = (users || []).filter((u: any) => u.chat_id);

    if (!recipients.length) {
      return new Response(
        JSON.stringify({ skipped: "no_recipients", events_found: toCheck.length }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // ── Перевіряємо кожну подію ───────────────────────────────
    const results: string[] = [];

    for (const ev of toCheck) {
      const evDate: string = ev.date;       // "YYYY-MM-DD"
      const evMD:   string = evDate.slice(5); // "MM-DD"
      const isYearly: boolean = !!ev.yearly;

      let kind: "today" | "tomorrow" | "in3days" | null = null;
      let displayDate = "";

      if (isYearly) {
        // Щорічна подія: порівнюємо тільки місяць і день
        if      (evMD === todayMD) { kind = "today";   displayDate = fmtDateUA(todayStr); }
        else if (evMD === plus1MD) { kind = "tomorrow"; displayDate = fmtDateUA(plus1Str); }
        else if (evMD === plus3MD) { kind = "in3days";  displayDate = fmtDateUA(plus3Str); }
      } else {
        // Разова подія: точна дата
        if      (evDate === todayStr) { kind = "today";   displayDate = fmtDateUA(evDate); }
        else if (evDate === plus1Str) { kind = "tomorrow"; displayDate = fmtDateUA(evDate); }
        else if (evDate === plus3Str) { kind = "in3days";  displayDate = fmtDateUA(evDate); }
      }

      if (!kind) continue; // ця подія сьогодні не нагадується

      const text = buildText(ev, displayDate, kind);

      for (const r of recipients) {
        await sendTelegram(r.chat_id, text);
      }

      results.push(`${kind}:${ev.title}`);
    }

    console.log("event-reminders done:", results);

    return new Response(
      JSON.stringify({
        sent: results.length,
        reminders: results,
        events_checked: toCheck.length,
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
