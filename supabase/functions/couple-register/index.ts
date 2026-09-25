// ============================================================
// couple-register — створення пари на ПОРОЖНЬОМУ порталі
// ------------------------------------------------------------
// Вхід:  { members: [{ name, pin }, { name, pin }], started_at: 'YYYY-MM-DD' }
// Вихід: { ok: true, couple_id, members: [{ id, name }] }
//        або { error: '…' } з названою причиною.
//
// ЧОМУ СЕРВЕР, А НЕ КЛІЄНТ. `users.pin_hash` і `users.email` закриті для
// anon/authenticated (revoke select — див. `auth-pin`), а створення
// користувача в Supabase Auth потребує service_role. Обидві причини
// однакові з тими, через які тут уже живе `auth-pin`.
//
// ЧОМУ ЛИШЕ НА ПОРОЖНЬОМУ ПОРТАЛІ. Рішення власника (2026-09-25). З 42
// таблиць ознаку пари несе одна (`wishlist_items.couple_id`), і не читає
// її ніхто, тож друга пара в цій же базі побачила б УСЮ історію першої —
// спогади, плани, фото. Поки ізоляції немає, функція відмовляє замість
// того, щоб «якось» спрацювати. Це не заглушка: відмова названа, і вона є
// правильною поведінкою, доки `couple_id` не стоїть на всіх таблицях.
//
// Деплой: supabase functions deploy couple-register
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Той самий PIN, що й у `auth-pin`: рівно вісім цифр. */
const PIN_RE = /^\d{8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Та сама межа, що в `USER_NAME_MAX` на клієнті (`lib/guards.ts`). */
const NAME_MAX = 32;
/** Домен пошти — ідентифікатора входу, якого пара ніколи не бачить. */
const EMAIL_DOMAIN = "portal.app";

interface MemberInput { name: string; pin: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = parseInput(body);
    if ("error" in parsed) return json({ error: parsed.error }, 400);
    const { members, startedAt } = parsed;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Порожність порталу перевіряється ПЕРЕД будь-яким записом.
    const { count, error: countErr } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });
    if (countErr) {
      console.error("couple-register: users count error:", countErr);
      return json({ error: "server_error" }, 500);
    }
    if ((count ?? 0) > 0) {
      // Названа відмова, а не тихий успіх: портал уже комусь належить.
      return json({ error: "portal_taken" }, 409);
    }

    const { data: couple, error: coupleErr } = await supabase
      .from("couples")
      .insert({})
      .select("id")
      .single();
    if (coupleErr || !couple) {
      console.error("couple-register: couples insert error:", coupleErr);
      return json({ error: "server_error" }, 500);
    }

    /*
     * Створене відкочується вручну, бо Edge-функція не має транзакції
     * поверх Auth: користувач в `auth.users` — це інша система, ніж рядок
     * у `public.users`. Половина створеної пари гірша за жодної: портал
     * перестав би бути порожнім, і друга спроба впала б на `portal_taken`,
     * тобто реєстрація заблокувала б сама себе НАЗАВЖДИ.
     */
    const createdAuthIds: string[] = [];
    const created: { id: number; name: string }[] = [];

    const rollback = async () => {
      for (const id of createdAuthIds) {
        const { error } = await supabase.auth.admin.deleteUser(id);
        if (error) console.error("couple-register: rollback auth user", id, error);
      }
      const { error: delUsers } = await supabase
        .from("users").delete().in("id", created.map((m) => m.id));
      if (delUsers) console.error("couple-register: rollback users", delUsers);
      const { error: delCouple } = await supabase
        .from("couples").delete().eq("id", couple.id);
      if (delCouple) console.error("couple-register: rollback couple", delCouple);
    };

    for (const [index, member] of members.entries()) {
      const email = `c${couple.id}m${index + 1}@${EMAIL_DOMAIN}`;
      const pinHash = await sha256Hex(member.pin);

      /*
       * Пароль у Supabase Auth — це САМ хеш PIN, а не PIN. Так уже
       * влаштований вхід: `auth-pin` віддає `password: user.pin_hash`,
       * і клієнт передає його в `signInWithPassword`. Якби тут паролем
       * став сам PIN, реєстрація пройшла б, а вхід — ні, і причину
       * довелось би шукати між двома системами.
       */
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: pinHash,
        email_confirm: true,
      });
      if (authErr || !authUser?.user) {
        console.error("couple-register: auth createUser error:", authErr);
        await rollback();
        return json({ error: "server_error" }, 500);
      }
      createdAuthIds.push(authUser.user.id);

      const { data: row, error: rowErr } = await supabase
        .from("users")
        .insert({
          name: member.name,
          email,
          pin_hash: pinHash,
          auth_user_id: authUser.user.id,
        })
        .select("id, name")
        .single();
      if (rowErr || !row) {
        console.error("couple-register: users insert error:", rowErr);
        await rollback();
        return json({ error: "server_error" }, 500);
      }
      created.push({ id: row.id, name: row.name });
    }

    const { error: membersErr } = await supabase
      .from("couple_members")
      .insert(created.map((m) => ({ couple_id: couple.id, user_id: m.id })));
    if (membersErr) {
      console.error("couple-register: couple_members insert error:", membersErr);
      await rollback();
      return json({ error: "server_error" }, 500);
    }

    /*
     * Дата початку — не оздоба анкети. З неї рушій бере вік артефакта й
     * початок тону (`portalSources.ts`), а без неї попередній перегляд
     * рифу просто кидає помилку. Тому вона входить у реєстрацію, а не
     * лишається на потім.
     */
    const { error: startErr } = await supabase
      .from("settings")
      .upsert({ key: "relationship_start_date", value: startedAt }, { onConflict: "key" });
    if (startErr) {
      console.error("couple-register: settings upsert error:", startErr);
      await rollback();
      return json({ error: "server_error" }, 500);
    }

    return json({ ok: true, couple_id: couple.id, members: created }, 200);
  } catch (e) {
    console.error("couple-register:", e);
    return json({ error: "server_error" }, 500);
  }
});

/**
 * Розбір входу — і він НЕ довіряє клієнтові.
 *
 * Ті самі правила стоять на екрані, і це навмисне дублювання: екран
 * існує, щоб пара не помилилась, а ця перевірка — щоб функцію не можна
 * було покликати мимо екрана.
 */
function parseInput(
  body: unknown,
): { members: MemberInput[]; startedAt: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "bad_request" };
  const { members, started_at: startedAt } = body as Record<string, unknown>;

  if (typeof startedAt !== "string" || !DATE_RE.test(startedAt)) {
    return { error: "bad_started_at" };
  }
  // Дата в майбутньому зробила б вік артефакта від'ємним.
  const today = new Date().toISOString().slice(0, 10);
  if (startedAt > today) return { error: "started_at_in_future" };

  if (!Array.isArray(members) || members.length !== 2) return { error: "need_two_members" };

  const clean: MemberInput[] = [];
  for (const raw of members) {
    if (!raw || typeof raw !== "object") return { error: "bad_member" };
    const { name, pin } = raw as Record<string, unknown>;
    if (typeof name !== "string") return { error: "bad_name" };
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > NAME_MAX) return { error: "bad_name" };
    if (typeof pin !== "string" || !PIN_RE.test(pin)) return { error: "bad_pin" };
    clean.push({ name: trimmed, pin });
  }
  // Двоє з однаковим іменем зробили б екран входу нерозрізненним.
  if (clean[0].name === clean[1].name) return { error: "same_name" };

  return { members: clean, startedAt };
}

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
