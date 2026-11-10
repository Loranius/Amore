// ============================================================
// Правила сповіщень списку покупок (ADR-0262).
// ------------------------------------------------------------
// Без імпортів і без Deno: той самий файл тягне Edge Function
// (`./shoppingRules.ts`) і перевіряє vitest
// (`src/features/shopping/shoppingNotify.test.ts`) — `deno test` у цьому
// проєкті не ганяє ні CI, ні `package.json` (див. `coupleRegistration.test.ts`).
//
// Дві вказівки власника (2026-11-10):
//   * «можливість не надсилати сповіщення в телеграм у самому модулі
//     покупок» — рядок несе `notify = false`, і тоді мовчить і додавання, і
//     «куплено»;
//   * «якщо пишуть в одному рядку багато покупок через кому — одне
//     повідомлення списком, а не окреме на кожну» — рядки одного вводу
//     несуть спільний `batch_id` і `batch_size`.
//
// Вебхук бази кличе функцію ОКРЕМО на кожен рядок і вже після коміту, тож
// рядки одного вставлення бачать усю партію. Надсилає лише рядок із
// найбільшим id у партії — решта мовчить. Так одне повідомлення, і жодного
// дубля, хоч скільки викликів прийде і в якому порядку.
// ============================================================

export interface ShoppingRowLike {
  id: number;
  title?: string | null;
  qty?: string | null;
  category?: string | null;
  notify?: boolean | null;
  batch_id?: string | null;
  batch_size?: number | null;
}

/** Текст для `parse_mode: "HTML"`: назву товару пише людина, і «<» у ній ламав би повідомлення. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function itemLine(row: ShoppingRowLike): string {
  const title = escapeHtml(row.title?.trim() || "без назви");
  const qty = row.qty?.trim() ? ` — ${escapeHtml(row.qty.trim())}` : "";
  return `<b>${title}</b>${qty}`;
}

/** Один товар — як і раніше: назва, кількість, полиця. */
export function singleShoppingText(row: ShoppingRowLike): string {
  const category = row.category ? `\n📂 ${escapeHtml(row.category)}` : "";
  return `🛒 Новий товар у списку покупок:\n${itemLine(row)}${category}`;
}

/** Кілька товарів з одного вводу — одним повідомленням, списком у порядку вводу. */
export function batchShoppingText(rows: readonly ShoppingRowLike[]): string {
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  return `🛒 Нові товари у списку покупок (${ordered.length}):\n${ordered.map((row) => `• ${itemLine(row)}`).join("\n")}`;
}

export type ShoppingInsertDecision =
  | { kind: "silent" }
  | { kind: "single"; text: string }
  | { kind: "needsBatch"; batchId: string }
  | { kind: "wait" }
  | { kind: "batch"; text: string };

/**
 * Що робити з новим рядком. `batchRows` — рядки тієї самої партії тієї самої
 * пари, коли їх уже прочитали (`null` — ще ні, і тоді відповідь
 * `needsBatch`).
 */
export function shoppingInsertDecision(
  record: ShoppingRowLike,
  batchRows: readonly ShoppingRowLike[] | null,
): ShoppingInsertDecision {
  if (record.notify === false) return { kind: "silent" };
  const size = record.batch_size ?? 1;
  if (!record.batch_id || size <= 1) return { kind: "single", text: singleShoppingText(record) };
  if (batchRows === null) return { kind: "needsBatch", batchId: record.batch_id };
  // Партія ще не вся видима — повідомлення надішле останній її рядок.
  if (batchRows.length < size) return { kind: "wait" };
  const last = Math.max(...batchRows.map((row) => row.id));
  if (record.id !== last) return { kind: "wait" };
  return { kind: "batch", text: batchShoppingText(batchRows) };
}

/** «Куплено» мовчить, якщо рядок тихий; інакше — як і раніше. */
export function boughtShoppingText(record: ShoppingRowLike, oldRecord: { bought?: boolean | null } | null): string | null {
  if (record.notify === false) return null;
  if (!oldRecord || oldRecord.bought) return null;
  if (!(record as { bought?: boolean | null }).bought) return null;
  return `✅ Куплено: <b>${escapeHtml(record.title?.trim() || "товар")}</b>`;
}
