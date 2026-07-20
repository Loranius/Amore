// ============================================================
// Supabase Edge Function: db-notify  v5
// Таблиці: transactions, personal_wishes, wishlist_items,
//          savings_goals, shopping_items, free_limit,
//          photo_calendar, dates
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function fmtN(n: number) {
  return Math.round(Math.abs(n || 0)).toLocaleString("uk-UA") + " ₴";
}

const MONTHS_UA = [
  "січня","лютого","березня","квітня","травня","червня",
  "липня","серпня","вересня","жовтня","листопада","грудня",
];

/** 'YYYY-MM-DD' → «26 липня». */
function fmtDateUA(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_UA[d.getMonth()]}`;
}

// ── Повідомлення за типом події ──────────────────────────────
function buildMessage(
  table: string, type: string, record: any, oldRecord: any
): { text: string; authorName: string | null } | null {

  // Транзакція
  if (table === "transactions" && type === "INSERT") {
    const isInc = record.type === "income";
    const desc = record.description ? `\n💬 ${record.description}` : "";
    return {
      text: `${isInc ? "➕" : "➖"} ${isInc ? "Дохід" : "Витрата"}: ${fmtN(record.amount)}\n📂 ${record.category || "Інше"}${desc}`,
      authorName: null,
    };
  }

  // Особисте бажання
  if (table === "personal_wishes" && type === "INSERT") {
    return {
      text: `🎁 Нове бажання у вішлісті!\n\n<b>${record.name || "без назви"}</b>${record.price ? `\n💰 ${fmtN(record.price)}` : ""}${record.url ? `\n🔗 ${record.url}` : ""}`,
      authorName: record.owner || null,
    };
  }

  // Спільний вішліст (wishlist_items) — обробляється окремо у handleWishlist

  // Спільна ціль — підтвердження
  if (table === "savings_goals" && type === "UPDATE") {
    if (oldRecord?.status === "pending" && record.status === "confirmed") {
      return {
        text: `✅ Спільну ціль підтверджено: <b>${record.name}</b>`,
        authorName: null,
      };
    }
    return null;
  }

  // Побачення — підтвердження (напр. з сайту, без Telegram-кнопки)
  if (table === "dates" && type === "UPDATE") {
    if (oldRecord?.status === "pending" && record.status === "confirmed") {
      return {
        text: `✅ Побачення підтверджено: <b>${record.title}</b> — ${fmtDateUA(record.date)}`,
        authorName: null,
      };
    }
    return null;
  }

  // Список покупок — новий товар
  if (table === "shopping_items" && type === "INSERT") {
    return {
      text: `🛒 Новий товар у списку покупок:\n<b>${record.title || "без назви"}</b>${record.qty ? ` — ${record.qty}` : ""}${record.category ? `\n📂 ${record.category}` : ""}`,
      authorName: null,
    };
  }

  // Список покупок — куплено
  if (table === "shopping_items" && type === "UPDATE") {
    if (oldRecord && !oldRecord.bought && record.bought) {
      return {
        text: `✅ Куплено: <b>${record.title || "товар"}</b>`,
        authorName: null,
      };
    }
    return null;
  }

  return null;
}

// ── Хелпери для users ────────────────────────────────────────
async function resolveUserById(id: any) {
  if (!id) return null;
  const { data } = await sb.from("users").select("id,name,chat_id").eq("id", id).single();
  return data || null;
}

async function resolveUserByName(name: string | null) {
  if (!name) return null;
  const { data } = await sb.from("users").select("id,name,chat_id").eq("name", name).single();
  return data || null;
}

async function getAllUsers() {
  const { data } = await sb.from("users").select("id,name,chat_id");
  return data || [];
}

// ── Надіслати Telegram повідомлення ──────────────────────────
async function sendTelegram(chatId: any, text: string, replyMarkup?: any) {
  const botToken = Deno.env.get("TG_BOT_TOKEN");
  if (!botToken) { console.error("TG_BOT_TOKEN не налаштований"); return null; }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  if (!res.ok) { console.error("Telegram error:", await res.text()); return null; }
  const data = await res.json();
  return data?.result?.message_id || null;
}

// ── Нова спільна ціль → кнопки партнеру ─────────────────────
async function handleNewGoal(record: any) {
  const allUsers = await getAllUsers();
  const partner = allUsers.find((u: any) => u.chat_id && u.name !== record.proposed_by);
  if (!partner) return true;

  const text =
    `🎯 <b>${record.proposed_by}</b> пропонує нову спільну ціль:\n\n` +
    `<b>${record.name}</b>` +
    (record.description ? `\n📝 ${record.description}` : "") +
    (record.target_amount ? `\n💰 ${fmtN(record.target_amount)}` : "") +
    (record.url ? `\n🔗 ${record.url}` : "");

  await sendTelegram(partner.chat_id, text, {
    inline_keyboard: [[
      { text: "✅ Підтвердити", callback_data: `goal_confirm_${record.id}` },
      { text: "❌ Відхилити",   callback_data: `goal_reject_${record.id}` },
    ]],
  });
  return true;
}

// ── Нове побачення → кнопки партнеру ─────────────────────────
async function handleNewDate(record: any) {
  const allUsers = await getAllUsers();
  const partner = allUsers.find((u: any) => u.chat_id && u.name !== record.proposed_by);
  if (!partner) return true;

  const text =
    `💗 <b>${record.proposed_by}</b> пропонує побачення:\n\n` +
    `<b>${record.title}</b>\n` +
    `📅 ${fmtDateUA(record.date)}` +
    (record.time ? ` о ${String(record.time).slice(0, 5)}` : "") +
    (record.place ? `\n📍 ${record.place}` : "") +
    (record.description ? `\n📝 ${record.description}` : "") +
    (record.url ? `\n🔗 ${record.url}` : "");

  await sendTelegram(partner.chat_id, text, {
    inline_keyboard: [[
      { text: "✅ Підтвердити", callback_data: `date_confirm_${record.id}` },
      { text: "❌ Відхилити",   callback_data: `date_reject_${record.id}` },
    ]],
  });
  return true;
}

// ── Пропозиція free_limit → кнопки партнеру ─────────────────
async function handleFreeLimitProposal(record: any, oldRecord: any) {
  if (oldRecord?.proposal_value || !record.proposal_value) return false;

  const allUsers = await getAllUsers();
  const recipient = allUsers.find((u: any) => u.chat_id && u.name !== record.proposed_by);
  if (!recipient) return true;

  const messageId = await sendTelegram(
    recipient.chat_id,
    `💰 <b>${record.proposed_by}</b> пропонує новий ліміт вільних витрат: ${fmtN(record.proposal_value)}`,
    {
      inline_keyboard: [[
        { text: "✅ Підтвердити", callback_data: "limit_confirm" },
        { text: "❌ Скасувати",   callback_data: "limit_reject" },
      ]],
    }
  );
  if (messageId) {
    await sb.from("free_limit").update({
      tg_chat_id: recipient.chat_id,
      tg_message_id: messageId,
    }).eq("id", 1);
  }
  return true;
}

// ── Спільний вішліст: нове бажання + резерв ──────────────────
// owner / reserved_by — ID (не імена), резолвимо за id.
// Нове бажання → лише партнеру (не власнику).
// Резерв → НІКОЛИ власнику (сюрприз зберігається).
async function handleWishlist(type: string, record: any, oldRecord: any) {
  const users = await getAllUsers();
  const owner = users.find((u: any) => u.id === record.owner) || null;

  if (type === "INSERT") {
    const ownerName = owner?.name || "Партнер";
    const text =
      `🎀 <b>${ownerName}</b> додав(ла) нове бажання!\n\n` +
      `<b>${record.title || "без назви"}</b>` +
      (record.price ? `\n💰 ${fmtN(record.price)}` : "") +
      (record.description ? `\n📝 ${record.description}` : "") +
      (record.link ? `\n🔗 ${record.link}` : "");
    const recipients = users.filter((u: any) => u.chat_id && u.id !== record.owner);
    for (const r of recipients) await sendTelegram(r.chat_id, text);
    return `wishlist_insert_sent_${recipients.length}`;
  }

  // UPDATE — якщо бажання позначено як виконане, нотифікацію
  // надішле handleWishFulfilled через прямий виклик — тут пропускаємо.
  if (record.fulfilled) return "wish_fulfilled_handled_directly";

  // UPDATE — тільки при бронюванні (false → true)
  if (!oldRecord?.reserved && record.reserved && record.reserved_by) {
    const reserver = users.find((u: any) => u.id === record.reserved_by) || null;
    const reserverName = reserver?.name || "Хтось";
    const text = `🎁 <b>${reserverName}</b> бронює подарунок:\n<b>${record.title || ""}</b>`;
    const recipients = users.filter((u: any) => u.chat_id && u.id !== record.owner);
    for (const r of recipients) await sendTelegram(r.chat_id, text);
    return `wishlist_reserve_sent_${recipients.length}`;
  }

  return "wishlist_update_ignored";
}

// ── Виконання бажання: надсилаємо різні тексти власнику і покупцю ──
// Викликається ПРЯМО з клієнта (не через DB Webhook).
// payload: { type: 'wish_fulfilled', itemTitle, ownerId, buyerId }
async function handleWishFulfilled(payload: any) {
  const { itemTitle, ownerId, buyerId } = payload;
  const users = await getAllUsers();

  const owner = users.find((u: any) => u.id === ownerId) || null;
  const buyer = users.find((u: any) => u.id === buyerId) || null;

  if (!owner || !buyer) {
    console.warn("handleWishFulfilled: user not found", { ownerId, buyerId });
    return "missing_users";
  }

  const title = itemTitle || "бажання";
  const isBuyerDima = buyer.name === "Діма";

  // Повідомлення власнику — чиє бажання виконали
  const ownerMsg = owner.name === "Лєна"
    ? `🎁 <b>Лєнусік!</b> Твоє бажання <b>«${title}»</b> виконано!\n💝 Дімусік подбав про тебе ✨🌸`
    : `🎁 <b>Дімусік!</b> Твоє бажання <b>«${title}»</b> виконано!\n💝 Лєнусік подбала про тебе ✨💙`;

  // Повідомлення покупцю — хто купив
  const buyerMsg = isBuyerDima
    ? `🌟 <b>Молодець, Дімусік!</b> Ти виконав бажання Лєнусіка —\n<b>«${title}»</b>!\nВона точно буде щасливою 💕`
    : `🌟 <b>Молодець, Лєнусік!</b> Ти виконала бажання Дімусіка —\n<b>«${title}»</b>!\nВін точно буде щасливим 💙`;

  await Promise.all([
    owner.chat_id ? sendTelegram(owner.chat_id, ownerMsg) : Promise.resolve(),
    (buyer.chat_id && buyer.id !== owner.id) ? sendTelegram(buyer.chat_id, buyerMsg) : Promise.resolve(),
  ]);

  return "wish_fulfilled_sent";
}

// ── Фото-календар: нове фото → сповіщення партнеру ───────────
async function handlePhotoCalendar(record: any) {
  try {
    const users = await getAllUsers();

    // Хто завантажив
    const uploader = users.find((u: any) => u.id === record.user_id);
    // Партнер — той, кому слати (не автор)
    const partner = users.find((u: any) => u.id !== record.user_id && u.chat_id);
    if (!partner?.chat_id) return "no_partner_chat_id";

    const name = uploader?.name || "Партнер";

    // Формат дати: "20 червня 2026"
    const months = [
      "січня","лютого","березня","квітня","травня","червня",
      "липня","серпня","вересня","жовтня","листопада","грудня",
    ];
    const dt = new Date(record.date);
    const dateLabel = `${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;

    const text =
      `📸 <b>${name}</b> додав(ла) фото на ${dateLabel}` +
      (record.comment ? `\n💬 ${record.comment}` : "");

    await sendTelegram(partner.chat_id, text);
    return "photo_calendar_notified";
  } catch (e) {
    console.error("handlePhotoCalendar error:", e);
    return "error";
  }
}

// ── Callback від inline-кнопок ────────────────────────────────
async function handleCallback(cbq: any) {
  const data     = cbq?.data || "";
  const chatId   = cbq?.message?.chat?.id;
  const msgId    = cbq?.message?.message_id;
  const botToken = Deno.env.get("TG_BOT_TOKEN")!;

  const answer = (text: string) =>
    fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cbq.id, text }),
    });

  const editMsg = (text: string) =>
    fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, parse_mode: "HTML" }),
    });

  // Ціль — підтвердити
  if (data.startsWith("goal_confirm_")) {
    const id = data.replace("goal_confirm_", "");
    const { data: goal } = await sb.from("savings_goals").select("name,proposed_by").eq("id", id).single();
    await sb.from("savings_goals").update({ status: "confirmed" }).eq("id", id);
    await editMsg(`✅ Ціль підтверджено: <b>${goal?.name || id}</b>`);
    await answer("Підтверджено!");
    if (goal?.proposed_by) {
      const author = await resolveUserByName(goal.proposed_by);
      if (author?.chat_id) {
        await sendTelegram(author.chat_id, `✅ Твою спільну ціль <b>${goal.name}</b> підтверджено!`);
      }
    }
    return;
  }

  // Ціль — відхилити
  if (data.startsWith("goal_reject_")) {
    const id = data.replace("goal_reject_", "");
    const { data: goal } = await sb.from("savings_goals").select("name,proposed_by").eq("id", id).single();
    await sb.from("savings_goals").delete().eq("id", id);
    await editMsg(`❌ Ціль відхилено: <b>${goal?.name || id}</b>`);
    await answer("Відхилено");
    if (goal?.proposed_by) {
      const author = await resolveUserByName(goal.proposed_by);
      if (author?.chat_id) {
        await sendTelegram(author.chat_id, `❌ Твою спільну ціль <b>${goal.name}</b> відхилено.`);
      }
    }
    return;
  }

  // Побачення — підтвердити
  if (data.startsWith("date_confirm_")) {
    const id = data.replace("date_confirm_", "");
    const { data: dt } = await sb.from("dates").select("title,date,proposed_by").eq("id", id).single();
    await sb.from("dates").update({ status: "confirmed" }).eq("id", id);
    await editMsg(`✅ Побачення підтверджено: <b>${dt?.title || id}</b>`);
    await answer("Підтверджено!");
    if (dt?.proposed_by) {
      const author = await resolveUserByName(dt.proposed_by);
      if (author?.chat_id) {
        await sendTelegram(author.chat_id, `✅ Твоє побачення <b>${dt.title}</b> підтверджено!`);
      }
    }
    return;
  }

  // Побачення — відхилити
  if (data.startsWith("date_reject_")) {
    const id = data.replace("date_reject_", "");
    const { data: dt } = await sb.from("dates").select("title,proposed_by").eq("id", id).single();
    await sb.from("dates").delete().eq("id", id);
    await editMsg(`❌ Побачення відхилено: <b>${dt?.title || id}</b>`);
    await answer("Відхилено");
    if (dt?.proposed_by) {
      const author = await resolveUserByName(dt.proposed_by);
      if (author?.chat_id) {
        await sendTelegram(author.chat_id, `❌ Твоє побачення <b>${dt.title}</b> відхилено.`);
      }
    }
    return;
  }

  // Ліміт — підтвердити
  if (data === "limit_confirm") {
    const { data: fl } = await sb.from("free_limit").select("*").eq("id", 1).single();
    if (fl?.proposal_value) {
      await sb.from("free_limit").update({
        limit_value: fl.proposal_value, proposal_value: null,
        proposed_by: null, tg_chat_id: null, tg_message_id: null,
      }).eq("id", 1);
      await editMsg(`✅ Ліміт встановлено: ${fmtN(fl.proposal_value)}`);
    }
    await answer("Підтверджено!");
    return;
  }

  // Ліміт — скасувати
  if (data === "limit_reject") {
    await sb.from("free_limit").update({
      proposal_value: null, proposed_by: null,
      tg_chat_id: null, tg_message_id: null,
    }).eq("id", 1);
    await editMsg("❌ Пропозицію ліміту скасовано");
    await answer("Скасовано");
    return;
  }
}

// ── Головний хендлер ─────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Telegram callback (кнопки ✅/❌)
    if (payload.callback_query) {
      await handleCallback(payload.callback_query);
      return new Response("ok", { headers: corsHeaders });
    }

    // ── Прямі виклики з клієнта (не DB Webhook) ──────────────
    // Розпізнаємо за наявністю payload.type без payload.table
    if (payload.type && !payload.table) {

      // Виконання бажання: надсилаємо різні тексти власнику і покупцю
      if (payload.type === "wish_fulfilled") {
        const handled = await handleWishFulfilled(payload);
        return new Response(JSON.stringify({ handled }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Невідомий тип прямого виклику — ігноруємо
      return new Response(JSON.stringify({ skipped: "unknown_direct_type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase Database Webhook
    const table     = payload.table;
    const record    = payload.record;
    const oldRecord = payload.old_record ?? null;
    const type: string = payload.type
      ?? (oldRecord && Object.keys(oldRecord).length ? "UPDATE" : "INSERT");

    // Глобальний тумблер сповіщень
    const { data: tgSetting } = await sb
      .from("settings").select("value")
      .eq("key", "telegram_notifications_enabled").maybeSingle();
    const tgEnabled = !tgSetting || tgSetting.value === "true" || tgSetting.value === true;
    if (!tgEnabled) {
      return new Response(JSON.stringify({ skipped: "notifications_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Нова спільна ціль — окрема гілка з кнопками
    if (table === "savings_goals" && type === "INSERT") {
      await handleNewGoal(record);
      return new Response(JSON.stringify({ handled: "new_goal" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Нове побачення — окрема гілка з кнопками
    if (table === "dates" && type === "INSERT") {
      await handleNewDate(record);
      return new Response(JSON.stringify({ handled: "new_date" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Пропозиція ліміту — окрема гілка з кнопками
    if (table === "free_limit" && type === "UPDATE") {
      const handled = await handleFreeLimitProposal(record, oldRecord);
      return new Response(JSON.stringify({ handled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Спільний вішліст — адресні отримувачі + імена за id
    if (table === "wishlist_items" && (type === "INSERT" || type === "UPDATE")) {
      const handled = await handleWishlist(type, record, oldRecord);
      return new Response(JSON.stringify({ handled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Фото-календар — INSERT → сповіщення партнеру
    if (table === "photo_calendar" && type === "INSERT") {
      const handled = await handlePhotoCalendar(record);
      return new Response(JSON.stringify({ handled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Всі інші події — широкомовне сповіщення
    const msg = buildMessage(table, type, record, oldRecord);
    if (!msg) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Визначаємо автора для підпису
    let author = msg.authorName ? await resolveUserByName(msg.authorName) : null;
    if (!author && table === "shopping_items" && type === "UPDATE" && record.bought_by) {
      author = await resolveUserById(record.bought_by);
    }
    if (!author && record.created_by) {
      author = await resolveUserById(record.created_by);
    }

    const allUsers = await getAllUsers();
    const recipients = allUsers.filter((u: any) => u.chat_id);
    const authorLabel = author?.name ? `<b>${author.name}</b>\n` : "";

    for (const r of recipients) {
      await sendTelegram(r.chat_id, `${authorLabel}${msg.text}`);
    }

    return new Response(JSON.stringify({ sent: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("db-notify error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
