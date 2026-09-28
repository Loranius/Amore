// ============================================================
// events-finder v4 — пошук подій через Claude + web search,
// з урахуванням графіка вихідних пари (max 3 пошуки для економії)
// Вхід:  { city, region, avoid?: [], freeDays?: [{date, off: [імена]}], names?: [імена] }
// Вихід: { events: [{title, description, when, place, url, price, kind, off_note}] }
// Секрети: CLAUDE_KEY
//
// v4 (ADR-0229): імена пари приходять із клієнта (`names`); до того в текст
// запиту були вшиті імена першої пари, а портал тепер багатопарний. Коду
// функції в репозиторії раніше не було: v3 узято з розгорнутої версії без
// змін, крім імен.
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

/** « (Олена і Марко)» з імен пари; без імен — порожньо, без вигаданих. */
export function coupleLabel(names: unknown): string {
  const clean = Array.isArray(names)
    ? names.filter((n): n is string => typeof n === "string" && n.trim() !== "").map((n) => n.trim()).slice(0, 2)
    : [];
  return clean.length ? ` (${clean.join(" і ")})` : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { city, region, avoid, freeDays, names } = await req.json();
    if (!city) return json({ error: "city required" }, 400);

    const apiKey = Deno.env.get("CLAUDE_KEY");
    if (!apiKey) return json({ error: "CLAUDE_KEY not set" }, 500);

    const today = new Date().toLocaleDateString("uk-UA", {
      timeZone: "Europe/Kyiv",
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });

    // Блок про графік: коли хто вільний найближчим тижнем
    let scheduleBlock = "";
    const fd = Array.isArray(freeDays) ? freeDays.filter((d: { date?: string; off?: string[] }) => d && d.date && Array.isArray(d.off) && d.off.length) : [];
    if (fd.length) {
      scheduleBlock = `\nГрафік вихідних пари на найближчі дні (в інші дні обоє працюють):\n${
        fd.map((d: { date: string; off: string[] }) =>
          `- ${d.date}: вихідний у ${d.off.length >= 2 ? "ОБОХ 🎉" : d.off[0]}`
        ).join("\n")
      }\n
Правила щодо графіка:
- Шукай події НАСАМПЕРЕД на дні з цього списку. Найвищий пріоритет — дні, коли вихідні ОБОЄ.
- НЕ пропонуй події на дні, коли обоє працюють (крім вечірніх після 19:00).
- Для КОЖНОЇ події заповни off_note українською:
  • якщо в день події вихідні обоє — "Цього дня ви обоє вихідні 🎉"
  • якщо вихідний лише в одного — "У {ім'я} вихідний, {інше ім'я} працює"
  • для місць без дати — порадь найкращий день: "Найкраще {дата} — ви обоє вільні"`;
    }

    const prompt = `Сьогодні ${today}. Знайди через пошук в інтернеті (максимум 3 пошуки, почни з афіші міста) РІВНО 3 варіанти, куди може піти закохана пара${coupleLabel(names)} у місті ${city} (${region ?? "Україна"}) найближчими днями.
${scheduleBlock}
Пріоритет: актуальні події з афіш (концерти, вистави, стендап, фестивалі, виставки, кінопрем'єри). Якщо актуальних подій бракує — доповни цікавими місцями для прогулянки (парк, озеро, набережна, музей, оглядовий майданчик).
${avoid && avoid.length ? `\nНЕ пропонуй це (вже показував): ${avoid.join("; ")}` : ""}

Вимоги до кожного варіанта:
- title — коротка назва українською
- description — 1-2 речення, чому варто піти парі
- when — дата/час або «будь-коли» для місць
- place — локація/адреса
- url — реальне посилання з результатів пошуку (афіша/квитки/сторінка місця). НЕ вигадуй URL — тільки з пошуку. Якщо посилання немає — null.
- price — ціна квитків якщо відома, інакше null (для безкоштовних — «безкоштовно»)
- kind — "подія" або "місце"
- off_note — примітка про вихідні (див. правила вище) або null, якщо графіка немає

Після пошуку відповідай ТІЛЬКИ валідним JSON без markdown і без жодного тексту довкола:
{"events": [{"title": "...", "description": "...", "when": "...", "place": "...", "url": "... або null", "price": "... або null", "kind": "подія", "off_note": "... або null"}]}`;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: 3 },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Anthropic error:", res.status, t);
      return json({ error: "anthropic " + res.status }, 502);
    }

    const out = await res.json();

    if (out.stop_reason === "max_tokens") {
      return json({ error: "відповідь обірвалась, спробуй ще раз" }, 502);
    }

    const text = (out.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("\n");

    const jStart = text.indexOf("{");
    const jEnd = text.lastIndexOf("}");
    if (jStart === -1 || jEnd === -1) {
      console.error("events-finder: JSON не знайдено:", text.slice(0, 300));
      return json({ error: "не вдалось розібрати відповідь" }, 502);
    }
    const parsed = JSON.parse(text.slice(jStart, jEnd + 1));

    if (!Array.isArray(parsed.events) || !parsed.events.length) {
      return json({ error: "події не знайдені" }, 502);
    }

    const events = parsed.events.slice(0, 3)
      .filter((e: { title?: string }) => e && e.title)
      .map((e: Record<string, unknown>) => ({
        title: String(e.title),
        description: e.description ? String(e.description) : "",
        when: e.when ? String(e.when) : "",
        place: e.place ? String(e.place) : "",
        url: e.url && String(e.url).startsWith("http") ? String(e.url) : null,
        price: e.price ? String(e.price) : null,
        kind: e.kind === "місце" ? "місце" : "подія",
        off_note: e.off_note ? String(e.off_note) : null,
      }));

    return json({ events }, 200);
  } catch (e) {
    console.error("events-finder:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
