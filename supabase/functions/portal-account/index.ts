// ============================================================
// portal-account — акаунт за поштою ↔ місце в парі (ADR-0228)
// ------------------------------------------------------------
// Реєстрація й вхід за поштою йдуть напряму через Supabase Auth (код із
// шести цифр, пароль). Ця функція відповідає лише на одне питання: ЧИЄ
// це місце в порталі, — і вміє прив'язати пошту до наявного місця.
//
//   { action: 'ping' }                      → { ok, registration: 'open' | 'closed' }
//   { action: 'link' }       + Bearer токен → { ok, state: 'member', user }
//                                             | { ok, state: 'claim', seats }
//                                             | { ok, state: 'empty' }
//                                             | { ok, state: 'taken' }
//   { action: 'claim', user_id, pin } + Bearer → { ok, user } | { error }
//
// ЧОМУ МІСЦЕ, А НЕ НОВИЙ КОРИСТУВАЧ. Усі дані пари посилаються на
// `users.id` (1 — Діма, 2 — Лєна). Новий рядок означав би чужу людину з
// порожньою історією. Тому пошта ПРИВ'ЯЗУЄТЬСЯ до наявного місця:
// `users.email` стає справжньою поштою, `users.auth_user_id` — новим
// акаунтом. Жоден рядок даних не змінюється і не переноситься.
//
// ЧИМ ДОВОДИТЬСЯ, ЩО МІСЦЕ ТВОЄ. Старим PIN цього місця — тим, яким Діма й
// Лєна заходили досі. Перевірка йде через `register_pin_attempt`, тож
// діє той самий замок: п'ять невдалих спроб — 15 хвилин очікування.
//
// ВІДКРИТТЯ РЕЄСТРАЦІЇ — РІШЕННЯ ВЛАСНИКА, А НЕ КОДУ. `ping` каже 'open'
// лише коли в оточенні функції стоїть PORTAL_REGISTRATION_OPEN=1 (або true). Власник
// ставить його ПІСЛЯ міграції брами членства й увімкнення хука токена:
// до того зареєстрований незнайомець бачив би дані пари.
//
// Деплой: supabase functions deploy portal-account
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Той самий PIN, що в `auth-pin`: рівно вісім цифр. */
const PIN_RE = /^\d{8}$/;
/** Домен службової пошти місць, до яких ще не прив'язали справжню. */
const SEAT_DOMAIN = "@portal.app";
/** Старий акаунт місця блокується, а не видаляється: так його можна повернути. */
const RETIRED_BAN = "876000h";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = body?.action;

    if (action === "ping") {
      // Значення секрету вводить людина в панелі: пробіл, лапки чи `true`
      // замість `1` не мусять тихо тримати реєстрацію закритою.
      const raw = Deno.env.get("PORTAL_REGISTRATION_OPEN");
      const flag = (raw ?? "").trim().replace(/^["']+|["']+$/g, "").toLowerCase();
      const open = flag === "1" || flag === "true";
      // `configured` каже лише, чи секрет із такою назвою взагалі є, —
      // без його значення: так видно, де помилка, у назві чи у значенні.
      return json({ ok: true, registration: open ? "open" : "closed", configured: raw !== undefined }, 200);
    }
    if (action !== "link" && action !== "claim") return json({ error: "bad_request" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Хто кличе — з токена, а не з тіла запиту: пошту в тілі можна вигадати.
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user?.email) return json({ error: "unauthenticated" }, 401);
    if (!caller.user.email_confirmed_at) return json({ error: "email_unconfirmed" }, 403);
    const email = caller.user.email.toLowerCase();

    const { data: users, error: usersErr } = await admin
      .from("users")
      .select("id, name, email, auth_user_id");
    if (usersErr) {
      console.error("portal-account: users select error:", usersErr);
      return json({ error: "server_error" }, 500);
    }
    const { data: members, error: membersErr } = await admin
      .from("couple_members")
      .select("user_id");
    if (membersErr) {
      console.error("portal-account: couple_members select error:", membersErr);
      return json({ error: "server_error" }, 500);
    }
    const memberIds = new Set((members ?? []).map((m) => m.user_id as number));
    const rows = (users ?? []) as { id: number; name: string; email: string | null; auth_user_id: string | null }[];
    const mine = rows.find((u) => (u.email ?? "").toLowerCase() === email);
    const seats = rows
      .filter((u) => memberIds.has(u.id) && (u.email ?? "").toLowerCase().endsWith(SEAT_DOMAIN))
      .map((u) => ({ id: u.id, name: u.name }))
      .sort((a, b) => a.id - b.id);

    if (action === "link") {
      if (mine && memberIds.has(mine.id)) {
        return json({ ok: true, state: "member", user: { id: mine.id, name: mine.name } }, 200);
      }
      if (seats.length > 0) return json({ ok: true, state: "claim", seats }, 200);
      if (rows.length === 0) return json({ ok: true, state: "empty" }, 200);
      return json({ ok: true, state: "taken" }, 200);
    }

    // ── claim ────────────────────────────────────────────────
    const userId = body?.user_id;
    const pin = body?.pin;
    if (!Number.isInteger(userId) || typeof pin !== "string" || !PIN_RE.test(pin)) {
      return json({ error: "bad_request" }, 400);
    }
    // Одна пошта — одне місце: інакше вхід не знав би, ким ти є.
    if (mine) return json({ error: "email_taken" }, 409);
    const seat = rows.find((u) => u.id === userId);
    if (!seat || !seats.some((s) => s.id === userId)) return json({ error: "seat_unavailable" }, 409);

    const { data: secret, error: secretErr } = await admin
      .from("users")
      .select("pin_hash")
      .eq("id", userId)
      .single();
    if (secretErr || !secret) {
      console.error("portal-account: pin select error:", secretErr);
      return json({ error: "server_error" }, 500);
    }
    const success = secret.pin_hash != null && (await sha256Hex(pin)) === secret.pin_hash;
    const { data: attempt, error: rpcErr } = await admin
      .rpc("register_pin_attempt", { p_user_id: userId, p_success: success })
      .maybeSingle();
    if (rpcErr) {
      console.error("portal-account: register_pin_attempt error:", rpcErr);
      return json({ error: "server_error" }, 500);
    }
    if ((attempt as { is_locked?: boolean } | null)?.is_locked) {
      return json({
        error: "locked",
        retryAfterSeconds: (attempt as { retry_after_seconds?: number }).retry_after_seconds ?? 900,
      }, 429);
    }
    if (!success) return json({ error: "invalid" }, 401);

    /*
     * Прив'язка — один UPDATE одного рядка. Умова `email = старій службовій`
     * робить його безпечним при двох одночасних спробах: друга не знайде
     * рядка й отримає `seat_unavailable`, а не перезапише першу.
     */
    const { data: updated, error: updErr } = await admin
      .from("users")
      .update({ email, auth_user_id: caller.user.id })
      .eq("id", userId)
      .eq("email", seat.email)
      .select("id, name")
      .maybeSingle();
    if (updErr) {
      console.error("portal-account: users update error:", updErr);
      return json({ error: "server_error" }, 500);
    }
    if (!updated) return json({ error: "seat_unavailable" }, 409);

    // Старий вхід за PIN цього місця більше не потрібен. Блокування, а не
    // видалення: якщо щось піде не так, власник поверне його одним кліком.
    if (seat.auth_user_id && seat.auth_user_id !== caller.user.id) {
      const { error: banErr } = await admin.auth.admin.updateUserById(seat.auth_user_id, {
        ban_duration: RETIRED_BAN,
      });
      if (banErr) console.error("portal-account: retire old auth user:", banErr);
    }

    return json({ ok: true, user: { id: updated.id, name: updated.name } }, 200);
  } catch (e) {
    console.error("portal-account:", e);
    return json({ error: "server_error" }, 500);
  }
});

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
