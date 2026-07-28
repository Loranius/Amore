// ============================================================
// Тести правила «кому й що слати».
// ------------------------------------------------------------
// Запуск: `deno test supabase/functions/event-reminders/`.
// ============================================================
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildText, reminderTargets, type Recipient } from "./reminderRules.ts";

const DIMA: Recipient = { id: 1, name: "Діма", chat_id: "111" };
const LENA: Recipient = { id: 2, name: "Лєна", chat_id: "222" };
const PAIR = [DIMA, LENA];

Deno.test("подія без прив'язки йде обом і з загальною підказкою", () => {
  const targets = reminderTargets({ type: "birthday", person_user_id: null }, PAIR);
  assertEquals(targets.map((t) => t.recipient.id), [1, 2]);
  assertEquals(targets.map((t) => t.personName), [null, null]);
});

Deno.test("день народження партнерки: сама вона нагадування не отримує", () => {
  const targets = reminderTargets({ type: "birthday", person_user_id: 2 }, PAIR);
  assertEquals(targets.length, 1);
  assertEquals(targets[0].recipient.id, 1);
  assertEquals(targets[0].personName, "Лєну");
});

Deno.test("день народження Діми — дзеркально", () => {
  const targets = reminderTargets({ type: "birthday", person_user_id: 1 }, PAIR);
  assertEquals(targets.map((t) => t.recipient.id), [2]);
  assertEquals(targets[0].personName, "Діму");
});

Deno.test("річниця з прив'язкою стосується обох — нікого не пропускаємо", () => {
  // Прив'язка тут не означає «це її свято»: річниця спільна за
  // визначенням, і мовчати комусь із двох було б втратою нагадування.
  const targets = reminderTargets({ type: "anniversary", person_user_id: 2 }, PAIR);
  assertEquals(targets.map((t) => t.recipient.id), [1, 2]);
  assertEquals(targets.map((t) => t.personName), ["Лєну", null]);
});

Deno.test("прив'язка до людини поза парою нікого не глушить", () => {
  // person_user_id вказує на когось, кого немає серед отримувачів:
  // повідомлення мусять піти обом, і без імені — бо його ніде взяти.
  const targets = reminderTargets({ type: "birthday", person_user_id: 99 }, PAIR);
  assertEquals(targets.map((t) => t.recipient.id), [1, 2]);
  assertEquals(targets.map((t) => t.personName), [null, null]);
});

Deno.test("невідоме ім'я лишається як є, а не калічиться", () => {
  const targets = reminderTargets(
    { type: "birthday", person_user_id: 3 },
    [DIMA, { id: 3, name: "Marta", chat_id: "333" }],
  );
  assertEquals(targets[0].personName, "Marta");
});

Deno.test("текст із іменем говорить про подарунок, без імені — загально", () => {
  const ev = { title: "День народження Лєни", description: null };

  assertEquals(
    buildText(ev, "4 січня", "in3days", "Лєну"),
    "⏰ <b>Через 3 дні (4 січня) — «День народження Лєни»</b>\n🎁 Час подбати про подарунок",
  );
  assertEquals(
    buildText(ev, "4 січня", "in3days", null),
    "⏰ <b>Через 3 дні (4 січня) — «День народження Лєни»</b>\n📋 Плануй заздалегідь",
  );
  assertEquals(
    buildText(ev, "4 січня", "today", "Лєну"),
    "🔴 <b>СЬОГОДНІ — «День народження Лєни»</b>\n📌 Привітай Лєну!",
  );
});

Deno.test("опис події додається останнім рядком у будь-якому варіанті", () => {
  const ev = { title: "Річниця", description: "столик о 19:00" };
  assertEquals(
    buildText(ev, "13 липня", "tomorrow", null),
    "⚠️ <b>Завтра (13 липня) — «Річниця»</b>\n🎯 Підготуйся заздалегідь\n💬 столик о 19:00",
  );
});
