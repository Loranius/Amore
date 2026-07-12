// ============================================================
// culinary-ai — конструктор страв через Claude (Anthropic API)
// Вхід:  { answers: {type, taste[], base[], ingredients, effort, cuisine}, avoid: [назви] }
// Вихід: { title, description, cuisine, time_minutes, difficulty, servings,
//          tools: [], ingredients: [{name, amount, unit, shop_cat}], steps: [] }
//
// Використовує секрет CLAUDE_KEY.
// Деплой: supabase functions deploy culinary-ai
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001"; // Haiku: утричі дешевше, для цієї задачі достатньо

const SHOP_CATS =
  "Овочі, Фрукти, М'ясо, Морепродукти, Напої, Побут, Посуд, Гігієна, Косметика, Канцелярія, Спорт, Інше";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { answers, avoid } = await req.json();
    if (!answers) return json({ error: "answers required" }, 400);

    const apiKey = Deno.env.get("CLAUDE_KEY");
    if (!apiKey) return json({ error: "CLAUDE_KEY not set" }, 500);

    const a = (k: string) => {
      const v = answers[k];
      return Array.isArray(v) ? v.join(", ") : (v ?? "-");
    };

    const prompt = `Придумай одну страву за вподобаннями пари з України.

Вподобання:
- Тип страви: ${a("type")}
- Смаковий профіль: ${a("taste")}
- Основа: ${a("base")}
- Інгредієнти: ${a("ingredients")}
- Час і складність: ${a("effort")}
- Кухня: ${a("cuisine")}
${avoid && avoid.length ? `\nВже пропонував (НЕ повторюй і не роби близькі варіації): ${avoid.join("; ")}` : ""}

Жорсткі правила:
- Обладнання ТІЛЬКИ: пательня, каструля, аерогриль (замість духовки), блендер, міксер. Ніяких духовок, грилів, су-відів.
- Якщо інгредієнти "базові" — використовуй лише те, що точно є в українських супермаркетах АТБ, Сільпо, Варус (звичайні овочі, м'ясо, крупи, молочка, базові спеції). Ніяких рідкісних сирів, екзотичних соусів чи трав.
- Якщо кухня "Здивуй мене" — обери сам будь-яку доречну кухню світу. Якщо "Авторська вигадка" — вигадай нову страву з креативною назвою, але реалістичну у приготуванні.
- Страва має бути смачною і реальною для приготування вдома, кроки чіткі й повні (з температурами, часом, вогнем), але стислі — максимум 10 кроків.
- Кількості вказуй у грамах, мл, шт, ст.л, ч.л.
- Кожному інгредієнту признач shop_cat — категорію для списку покупок, строго одну з: ${SHOP_CATS}.

Відповідай ТІЛЬКИ валідним JSON без markdown, у форматі:
{
  "title": "Назва страви українською",
  "description": "1-2 речення, чому це смачно",
  "cuisine": "Кухня",
  "time_minutes": 30,
  "difficulty": "Просте",
  "servings": 2,
  "tools": ["пательня"],
  "ingredients": [{"name": "...", "amount": "200", "unit": "г", "shop_cat": "Овочі"}],
  "steps": ["Крок 1...", "Крок 2..."]
}`;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Anthropic error:", res.status, t);
      return json({ error: "anthropic " + res.status }, 502);
    }

    const out = await res.json();

    if (out.stop_reason === "max_tokens") {
      console.error("culinary-ai: відповідь обрізана по max_tokens");
      return json({ error: "відповідь обірвалась, спробуй ще раз" }, 502);
    }

    let text = (out.content ?? [])
      .map((b: { type: string; text?: string }) => b.type === "text" ? b.text : "")
      .join("");
    // Витягуємо JSON навіть якщо модель додала преамбулу чи ```-огорожі
    const jStart = text.indexOf("{");
    const jEnd = text.lastIndexOf("}");
    if (jStart === -1 || jEnd === -1) {
      console.error("culinary-ai: JSON не знайдено у відповіді:", text.slice(0, 200));
      return json({ error: "не вдалось розібрати відповідь" }, 502);
    }
    const dish = JSON.parse(text.slice(jStart, jEnd + 1));

    // Валідація і нормалізація
    if (!dish.title || !Array.isArray(dish.ingredients)) {
      return json({ error: "bad structure" }, 502);
    }
    dish.ingredients = dish.ingredients
      .filter((i: { name?: string }) => i && i.name)
      .map((i: Record<string, unknown>) => ({
        name: String(i.name),
        amount: i.amount == null ? "" : String(i.amount),
        unit: i.unit == null ? "" : String(i.unit),
        shop_cat: i.shop_cat == null ? "Інше" : String(i.shop_cat),
      }));
    dish.steps = Array.isArray(dish.steps) ? dish.steps.map(String) : [];
    dish.tools = Array.isArray(dish.tools) ? dish.tools.map(String) : [];
    dish.servings = Number(dish.servings) || 2;
    dish.time_minutes = Number(dish.time_minutes) || null;

    return json(dish, 200);
  } catch (e) {
    console.error("culinary-ai:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
