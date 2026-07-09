// ============================================================
// shopping-parse — розумний парсинг списку покупок через Claude
// (заміна старої Groq-версії, контракт той самий)
// Вхід:  { text: "молоко 2л, огірки кіло і зубна паста" }
// Вихід: { items: [{ title, qty, category }] }
//
// Використовує секрет CLAUDE_KEY.
// Деплой: supabase functions deploy shopping-parse
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const CATEGORIES = [
  "Овочі",
  "Фрукти",
  "М'ясо",
  "Морепродукти",
  "Напої",
  "Побут",
  "Посуд",
  "Гігієна",
  "Косметика",
  "Канцелярія",
  "Спорт",
  "Інше",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || !String(text).trim()) {
      return json({ error: "text required" }, 400);
    }

    const apiKey = Deno.env.get("CLAUDE_KEY");
    if (!apiKey) return json({ error: "CLAUDE_KEY not set" }, 500);

    const prompt = `Розбери текст списку покупок на окремі товари.

Текст: "${String(text).slice(0, 1000)}"

Правила:
- Кожен товар: title (назва з великої літери, називний відмінок, однина або як прийнято: "Огірки"), qty (кількість як текст: "2 л", "1 кг", "3 шт", або null якщо не вказано), category — строго одна з: ${CATEGORIES.join(", ")}.
- Молочка, крупи, хліб, бакалія, солодощі, заморозка — це "Інше", якщо не підходить жодна точніша категорія.
- Побутова хімія, засоби для прибирання, лампочки — "Побут". Мило, шампунь, зубна паста — "Гігієна". Крем, туш, парфуми — "Косметика".
- Не вигадуй товари, яких немає в тексті. Виправляй одруківки.

Відповідай ТІЛЬКИ валідним JSON без markdown:
{"items": [{"title": "...", "qty": "..." , "category": "..."}]}`;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Anthropic error:", res.status, t);
      return json({ error: "anthropic " + res.status }, 502);
    }

    const out = await res.json();
    let raw = (out.content ?? [])
      .map((b: { type: string; text?: string }) => b.type === "text" ? b.text : "")
      .join("");
    const jStart = raw.indexOf("{");
    const jEnd = raw.lastIndexOf("}");
    if (jStart === -1 || jEnd === -1) return json({ error: "не вдалось розібрати відповідь" }, 502);
    const parsed = JSON.parse(raw.slice(jStart, jEnd + 1));

    if (!Array.isArray(parsed.items)) return json({ error: "bad structure" }, 502);

    const items = parsed.items
      .filter((i: { title?: string }) => i && i.title)
      .map((i: Record<string, unknown>) => ({
        title: String(i.title),
        qty: i.qty == null || i.qty === "" ? null : String(i.qty),
        category: CATEGORIES.includes(String(i.category)) ? String(i.category) : "Інше",
      }));

    return json({ items }, 200);
  } catch (e) {
    console.error("shopping-parse:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
