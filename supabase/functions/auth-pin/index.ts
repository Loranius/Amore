// ============================================================
// auth-pin — серверна перевірка PIN-коду для входу
// Вхід:  { user_id: number, pin: string (8 цифр) }
// Вихід: { ok: true, email, password } — password = sha256(pin), той самий
//        рядок, що й пароль у Supabase Auth (signInWithPassword).
//        Або { error: 'invalid' } / { error: 'locked', retryAfterSeconds }.
//
// pin_hash/email у таблиці users закриті для anon/authenticated (revoke
// select) — їх бачить лише service_role, тому перевірка PIN винесена сюди
// з клієнта. register_pin_attempt() рахує невдалі спроби атомарно
// (SECURITY DEFINER RPC) і блокує на 15 хв після 5 підряд невдалих спроб.
//
// Деплой: supabase functions deploy auth-pin
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PIN_RE = /^\d{8}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, pin } = await req.json();

    if (!Number.isInteger(user_id) || typeof pin !== "string" || !PIN_RE.test(pin)) {
      return json({ error: "bad_request" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("pin_hash, email")
      .eq("id", user_id)
      .maybeSingle();

    if (userErr) {
      console.error("auth-pin: users select error:", userErr);
      return json({ error: "server_error" }, 500);
    }
    if (!user) return json({ error: "invalid" }, 401);

    const success = user.pin_hash != null && (await sha256Hex(pin)) === user.pin_hash;

    const { data: attempt, error: rpcErr } = await supabase
      .rpc("register_pin_attempt", { p_user_id: user_id, p_success: success })
      .maybeSingle();

    if (rpcErr) {
      console.error("auth-pin: register_pin_attempt error:", rpcErr);
      return json({ error: "server_error" }, 500);
    }

    if (attempt?.is_locked) {
      return json({ error: "locked", retryAfterSeconds: attempt.retry_after_seconds }, 429);
    }

    if (!success) return json({ error: "invalid" }, 401);

    return json({ ok: true, email: user.email, password: user.pin_hash }, 200);
  } catch (e) {
    console.error("auth-pin:", e);
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
