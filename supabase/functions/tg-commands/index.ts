// ============================================================
// Supabase Edge Function: tg-commands
// Приймає вебхук від Telegram (сирі апдейти бота Amore) і
// обробляє слеш-команди прямо в чаті:
//
//   /shopping        — активний список покупок (по категоріях)
//   /wishlist        — активні бажання партнера
//   /sizes           — мої розміри
//   /sizes_partner   — розміри партнера
//   /movie           — випадковий фільм (TMDB)
//   /food            — що приготувати сьогодні (рандом зі списку страв)
//   /weekends        — найближчі спільні вихідні (обидва Х в графіку)
//   /help, /start    — список команд
//
// Налаштування (Supabase → Edge Functions → Secrets):
//   TG_BOT_TOKEN               — той самий токен бота, що вже стоїть у проекті
//   SUPABASE_URL               — з Project Settings → API
//   SUPABASE_SERVICE_ROLE_KEY  — з Project Settings → API (service_role!)
//   TMDB_API_KEY (необов'язково — інакше візьме публічний ключ з фронтенду)
//   TG_PHOTO_CHANNEL_ID (необов'язково) — обмежити фото-архів одним каналом
//
// ЦЕ ЄДИНИЙ ВЕБХУК БОТА. Слеш-команди обробляє сам,
// callback_query (кнопки ✅/❌) форвардить у db-notify,
// channel_post з фото → заливає в Storage (фото-архів порталу).
//
// Після деплою прив'яжи вебхук (один раз, з браузера чи curl):
//   https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=<SUPABASE_URL>/functions/v1/tg-commands&allowed_updates=["message","callback_query","channel_post"]
//
// ВАЖЛИВО: деплой з --no-verify-jwt, бо Telegram не шле авторизацію:
//   supabase functions deploy tg-commands --no-verify-jwt
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TG_BOT_TOKEN") ?? Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPA_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Публічний ключ TMDB — той самий, що вже в modules/media.js і modules/swipe.js.
const TMDB_KEY  = Deno.env.get("TMDB_API_KEY") || "1b28cacaab2f90a8c2bd0c383c636f01";
const TMDB_BASE = "https://api.themoviedb.org/3";

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const db = createClient(SUPA_URL, SUPA_KEY);

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Той самий порядок категорій, що й у modules/shopping.js
const CATEGORIES = [
  "Овочі", "Фрукти", "М'ясо", "Морепродукти", "Напої",
  "Побут", "Посуд", "Гігієна", "Косметика", "Канцелярія",
  "Спорт", "Інше",
];

const COMMANDS_HELP =
  "<b>Команди боту Amore 💗</b>\n\n" +
  "/shopping — список покупок\n" +
  "/wishlist — бажання партнера\n" +
  "/sizes — мої розміри\n" +
  "/sizes_partner — розміри партнера\n" +
  "/movie — випадковий фільм\n" +
  "/food — що приготувати сьогодні\n" +
  "/weekends — найближчі спільні вихідні\n" +
  "/help — це повідомлення";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function send(chatId: number | string, text: string) {
  const id = Number(chatId);
  if (!id) return;
  const res = await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: id, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) console.error(`TG send error (chat_id=${id}):`, await res.text());
}

// ── Користувачі ──────────────────────────────────────────────
async function findUserByChat(chatId: number) {
  const { data } = await db.from("users").select("id,name,chat_id").eq("chat_id", chatId).maybeSingle();
  return data;
}

async function findPartner(userId: number) {
  const { data } = await db.from("users").select("id,name,chat_id").neq("id", userId).limit(1).maybeSingle();
  return data;
}

// ── /shopping ────────────────────────────────────────────
async function cmdShopping(chatId: number) {
  const { data, error } = await db
    .from("shopping_items")
    .select("title,qty,category")
    .eq("bought", false);

  if (error) { await send(chatId, "⚠️ Не вдалось завантажити список покупок."); return; }
  if (!data || !data.length) { await send(chatId, "🛒 Список покупок порожній."); return; }

  type Item = { title: string; qty: string | null; category: string | null };
  const items: Item[] = data;
  const byCat: Record<string, Item[]> = {};
  items.forEach((i) => {
    const cat = i.category || "Інше";
    (byCat[cat] ||= []).push(i);
  });
  const order = [...CATEGORIES, ...Object.keys(byCat).filter((c) => !CATEGORIES.includes(c))];

  let text = "<b>🛒 Список покупок</b>\n";
  for (const cat of order) {
    const items = byCat[cat];
    if (!items || !items.length) continue;
    text += `\n<b>${esc(cat)}</b>\n`;
    text += items.map((i) => `• ${esc(i.title)}${i.qty ? ` (${esc(i.qty)})` : ""}`).join("\n") + "\n";
  }
  await send(chatId, text.trim());
}

// ── /wishlist (бажання партнера) ────────────────────────────
async function cmdWishlist(chatId: number, partner: { id: number; name: string } | null) {
  if (!partner) { await send(chatId, "⚠️ Не вдалось знайти партнера."); return; }

  const { data, error } = await db
    .from("wishlist_items")
    .select("title,price,priority,link")
    .eq("owner", partner.id)
    .or("fulfilled.is.null,fulfilled.eq.false")
    .order("id", { ascending: false });

  if (error) { await send(chatId, "⚠️ Не вдалось завантажити бажання."); return; }
  if (!data || !data.length) { await send(chatId, `🎁 У ${esc(partner.name)} поки немає активних бажань.`); return; }

  const PRIORITY_ICON: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
  let text = `<b>🎁 Бажання ${esc(partner.name)}</b>\n\n`;
  text += data.map((i) => {
    const icon = i.priority ? (PRIORITY_ICON[i.priority] || "•") : "•";
    const price = i.price ? ` — ${esc(i.price)}` : "";
    const link = i.link ? `\n${esc(i.link)}` : "";
    return `${icon} ${esc(i.title)}${price}${link}`;
  }).join("\n\n");

  await send(chatId, text);
}

// ── /sizes, /sizes_partner ──────────────────────────────────
async function cmdSizes(chatId: number, target: { id: number; name: string }) {
  const { data } = await db.from("user_sizes").select("*").eq("user_id", target.id).maybeSingle();
  const sz = data || {};
  const isFemale = target.name === "Лєна";

  let text = `<b>📏 Розміри — ${esc(target.name)}</b>\n\n`;
  text += `<b>Базові габарити</b>\n`;
  text += `Зріст: ${esc(sz.height || "—")} см\n`;
  text += `Груди: ${esc(sz.chest || "—")} см\n`;
  text += `Талія: ${esc(sz.waist || "—")} см\n`;
  text += `Стегна: ${esc(sz.hips || "—")} см\n\n`;
  text += `<b>Одяг</b>\n`;
  text += `Міжнар.: ${esc(sz.intl_size || "—")} / EU: ${esc(sz.eu_size || "—")} / UA: ${esc(sz.ua_size || "—")}\n\n`;
  text += `<b>Взуття</b>\n`;
  text += `Устілка: ${esc(sz.insole_cm || "—")} см / EU: ${esc(sz.shoe_eu || "—")} / US: ${esc(sz.shoe_us || "—")}\n`;
  if (isFemale) {
    text += `\n<b>Нижня білизна</b>\n`;
    text += `Бюстгалтер: ${esc(sz.bra || "—")} / Труси: ${esc(sz.underwear || "—")}\n`;
  }
  text += `\n<b>Аксесуари</b>\n`;
  text += `Каблучка (безім.): ${esc(sz.ring_ring || "—")} / (вказ.): ${esc(sz.ring_index || "—")}`;

  await send(chatId, text);
}

// ── /movie ───────────────────────────────────────────────
async function cmdMovie(chatId: number) {
  try {
    const page = 1 + Math.floor(Math.random() * 20); // TMDB popular, перші 20 сторінок
    const res = await fetch(
      `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=uk-UA&sort_by=popularity.desc&vote_count.gte=200&page=${page}`,
    );
    const json = await res.json();
    const results = json.results || [];
    if (!results.length) { await send(chatId, "🎬 Не вдалось знайти фільм, спробуй ще раз."); return; }

    const movie = results[Math.floor(Math.random() * results.length)];
    const year = (movie.release_date || "").slice(0, 4) || "—";
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "—";
    const overview = movie.overview ? `\n\n${esc(movie.overview)}` : "";

    const text =
      `<b>🎬 ${esc(movie.title)}</b> (${year})\n` +
      `⭐ ${rating}/10${overview}`;

    await send(chatId, text);
  } catch (e) {
    console.error("cmdMovie error:", e);
    await send(chatId, "⚠️ TMDB зараз недоступний, спробуй пізніше.");
  }
}

// ── /food ────────────────────────────────────────────────
async function cmdFood(chatId: number) {
  const { data, error } = await db.from("dishes").select("title,recipe");
  if (error) { await send(chatId, "⚠️ Не вдалось завантажити список страв."); return; }
  if (!data || !data.length) { await send(chatId, "🍽 Пул страв порожній — збережи улюблені в Кулінарії!"); return; }

  const pick = data[Math.floor(Math.random() * data.length)];
  let text = `🍽 Сьогодні готуємо: <b>${esc(pick.title)}</b>`;

  // Якщо у страви є рецепт — показуємо інгредієнти
  const r = pick.recipe as { servings?: number; ingredients?: { name: string; amount?: string; unit?: string }[] } | null;
  if (r && Array.isArray(r.ingredients) && r.ingredients.length) {
    text += r.servings ? `\n🍽 Порцій: ${r.servings}` : "";
    text += "\n\n<b>Інгредієнти:</b>\n";
    text += r.ingredients
      .map((i) => `• ${esc(i.name)}${i.amount || i.unit ? ` — ${esc([i.amount, i.unit].filter(Boolean).join(" "))}` : ""}`)
      .join("\n");
    text += "\n\n📖 Повний рецепт — у порталі, вкладка Кулінарія";
  }
  await send(chatId, text);
}

// ── /weekends (найближчі спільні вихідні) ───────────────────
async function cmdWeekends(chatId: number) {
  const { data: users } = await db.from("users").select("id");
  const userIds = (users || []).map((u) => u.id);
  if (userIds.length < 2) { await send(chatId, "⚠️ Не вдалось визначити обох користувачів."); return; }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const { data, error } = await db
    .from("work_schedule")
    .select("date,user_id,mark")
    .eq("mark", "Х")
    .gte("date", todayStr)
    .order("date", { ascending: true })
    .limit(500);

  if (error) { await send(chatId, "⚠️ Не вдалось завантажити графік."); return; }

  const byDate: Record<string, Set<number>> = {};
  (data || []).forEach((r) => {
    (byDate[r.date] ||= new Set()).add(r.user_id);
  });

  const shared = Object.keys(byDate)
    .filter((d) => userIds.every((id) => byDate[d].has(id)))
    .sort()
    .slice(0, 8);

  if (!shared.length) {
    await send(chatId, "📅 Найближчим часом спільних вихідних не заплановано (або графік ще не заповнено).");
    return;
  }

  const fmt = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("uk-UA", { day: "numeric", month: "long", weekday: "short" });
  };

  const text = "<b>📅 Найближчі спільні вихідні</b>\n\n" + shared.map((d) => `• ${fmt(d)}`).join("\n");
  await send(chatId, text);
}

// ── Роутинг команд ───────────────────────────────────────
async function handleCommand(cmd: string, chatId: number, user: { id: number; name: string }) {
  const partner = await findPartner(user.id);

  switch (cmd) {
    case "shopping":
      return cmdShopping(chatId);
    case "wishlist":
      return cmdWishlist(chatId, partner);
    case "sizes":
      return cmdSizes(chatId, user);
    case "sizes_partner":
      if (!partner) return send(chatId, "⚠️ Не вдалось знайти партнера.");
      return cmdSizes(chatId, partner);
    case "movie":
      return cmdMovie(chatId);
    case "food":
      return cmdFood(chatId);
    case "weekends":
      return cmdWeekends(chatId);
    case "start":
    case "help":
      return send(chatId, `Привіт, ${esc(user.name)}! 💗\n\n${COMMANDS_HELP}`);
    default:
      return send(chatId, "Не знаю такої команди. Напиши /help, щоб побачити список.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const update = await req.json();

    // ── Фото-архів: пост із фото в каналі → Supabase Storage ──
    // Бот-адмін каналу отримує channel_post; фото (або зображення-документ,
    // якщо надіслано без стиснення) заливається в бакет family_photos
    // і автоматично з'являється у хмарці фото на головній порталу.
    const post = update.channel_post;
    if (post && (post.photo || (post.document && String(post.document.mime_type || "").startsWith("image/")))) {
      await saveChannelPhoto(post);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Кнопки ✅/❌ (ліміт, спільні цілі) обробляє db-notify —
    // форвардимо callback_query туди, бо вебхук у бота лише один.
    if (update.callback_query) {
      const res = await fetch(`${SUPA_URL}/functions/v1/db-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPA_KEY}`,
        },
        body: JSON.stringify(update),
      });
      if (!res.ok) console.error("Форвард у db-notify:", res.status, await res.text());
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const message = update.message;
    const text: string | undefined = message?.text;
    const chatId: number | undefined = message?.chat?.id;

    if (!chatId || !text || !text.startsWith("/")) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const cmd = text.slice(1).split(/[\s@]/)[0].toLowerCase();

    const user = await findUserByChat(chatId);
    if (!user) {
      await send(chatId, "Цей бот приватний 🔒");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    await handleCommand(cmd, chatId, user);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("tg-commands error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ============================================================
// Фото з каналу → Supabase Storage (bucket family_photos)
// ============================================================
async function saveChannelPhoto(post: {
  chat: { id: number };
  message_id: number;
  photo?: { file_id: string; file_unique_id: string }[];
  document?: { file_id: string; file_unique_id: string; mime_type?: string; file_name?: string };
}) {
  try {
    // Опційний фільтр: якщо задано TG_PHOTO_CHANNEL_ID — приймаємо лише його
    const onlyChannel = Deno.env.get("TG_PHOTO_CHANNEL_ID");
    if (onlyChannel && String(post.chat.id) !== String(onlyChannel)) return;

    // Документ-зображення = оригінал без стиснення; фото — найбільший розмір
    let fileId = "";
    let uniqueId = "";
    if (post.document) {
      fileId = post.document.file_id;
      uniqueId = post.document.file_unique_id;
    } else if (post.photo && post.photo.length) {
      const largest = post.photo[post.photo.length - 1];
      fileId = largest.file_id;
      uniqueId = largest.file_unique_id;
    }
    if (!fileId) return;

    // getFile → шлях → завантаження байтів
    const gf = await fetch(`${TG}/getFile?file_id=${fileId}`);
    const gfJson = await gf.json();
    const filePath: string | undefined = gfJson?.result?.file_path;
    if (!filePath) { console.error("saveChannelPhoto: getFile без file_path", gfJson); return; }

    const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    if (!fileRes.ok) { console.error("saveChannelPhoto: download", fileRes.status); return; }
    const bytes = new Uint8Array(await fileRes.arrayBuffer());

    const ext = (filePath.split(".").pop() || "jpg").toLowerCase();
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const name = `tg_${uniqueId}.${ext}`; // unique_id = дедуплікація повторних постів

    // Заливка у Storage (service role, upsert=false: дублікат → 409, це ок)
    const up = await fetch(`${SUPA_URL}/storage/v1/object/family_photos/${name}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
    });

    if (up.ok) {
      // Сердечко на пост — підтвердження, що фото на порталі
      await fetch(`${TG}/setMessageReaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: post.chat.id,
          message_id: post.message_id,
          reaction: [{ type: "emoji", emoji: "❤" }],
        }),
      }).catch(() => {});
    } else if (up.status !== 409) {
      console.error("saveChannelPhoto: upload", up.status, await up.text());
    }
  } catch (e) {
    console.error("saveChannelPhoto:", e);
  }
}
