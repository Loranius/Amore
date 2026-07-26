import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_HTML_BYTES = 600_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 6_000;

type PreviewErrorCode =
  | "invalid_url"
  | "blocked_url"
  | "fetch_failed"
  | "unsupported_content"
  | "response_too_large"
  | "no_metadata";

class PreviewError extends Error {
  constructor(readonly code: PreviewErrorCode) {
    super(code);
  }
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };

  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || name === "meta" || name === "script") continue;
    attrs[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attrs;
}

function extractMeta(html: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    const content = attrs.content?.trim();
    if (key && content && !values.has(key)) values.set(key, content);
  }

  return values;
}

function findTypedObject(value: unknown, wantedType: string, depth = 0): Record<string, unknown> | null {
  if (depth > 7 || value === null || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTypedObject(item, wantedType, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  const rawType = object["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  if (types.some((type) => String(type ?? "").toLowerCase() === wantedType.toLowerCase())) {
    return object;
  }

  for (const child of Object.values(object)) {
    const found = findTypedObject(child, wantedType, depth + 1);
    if (found) return found;
  }

  return null;
}

function extractProductJsonLd(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = parseAttributes(match[1] ?? "");
    if ((attrs.type ?? "").toLowerCase() !== "application/ld+json") continue;

    const raw = decodeHtml(match[2] ?? "").trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const product = findTypedObject(parsed, "Product");
      if (product) return product;
    } catch {
      // Some shops emit malformed JSON-LD. Open Graph remains the fallback.
    }
  }

  return null;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return firstString(object.url ?? object.contentUrl ?? object["@id"]);
  }
  return null;
}

function firstOffer(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const offer = firstOffer(item);
      if (offer) return offer;
    }
    return null;
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;

  let normalized = value.replace(/[\s\u00a0]/g, "").replace(/[^0-9,.-]/g, "");
  if (!normalized) return null;

  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma > dot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (dot > comma) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isBlockedIp(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isBlockedIpv4(normalized)) return true;

  if (!normalized.includes(":")) return false;
  if (normalized === "::" || normalized === "::1") return true;
  if (/^(fc|fd)/.test(normalized)) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (/^ff/.test(normalized)) return true;
  if (normalized.startsWith("2001:db8:")) return true;

  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isBlockedIpv4(mappedIpv4) : false;
}

async function assertSafeUrl(candidate: URL): Promise<void> {
  if (!['http:', 'https:'].includes(candidate.protocol)) throw new PreviewError("invalid_url");
  if (candidate.username || candidate.password) throw new PreviewError("blocked_url");
  if (candidate.port && candidate.port !== "80" && candidate.port !== "443") {
    throw new PreviewError("blocked_url");
  }

  const hostname = candidate.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".lan")
    || hostname.endsWith(".home")
    || (!hostname.includes(".") && !hostname.includes(":"))) {
    throw new PreviewError("blocked_url");
  }

  if (isBlockedIp(hostname)) throw new PreviewError("blocked_url");
  if (hostname.includes(":")) return;

  const resolved: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      resolved.push(...await Deno.resolveDns(hostname, type));
    } catch {
      // A host may expose only one address family.
    }
  }

  if (resolved.length === 0) throw new PreviewError("fetch_failed");
  if (resolved.some(isBlockedIp)) throw new PreviewError("blocked_url");
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_HTML_BYTES) throw new PreviewError("response_too_large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new PreviewError("response_too_large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function fetchHtml(initialUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let currentUrl = initialUrl;

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      await assertSafeUrl(currentUrl);
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Accept": "text/html,application/xhtml+xml;q=0.9",
          "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.6",
          "User-Agent": "AmoreWishlistPreview/1.0",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) throw new PreviewError("fetch_failed");
        currentUrl = new URL(location, currentUrl);
        continue;
      }

      if (!response.ok) throw new PreviewError("fetch_failed");
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        throw new PreviewError("unsupported_content");
      }

      return { html: await readLimitedText(response), finalUrl: currentUrl };
    }
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError("fetch_failed");
  } finally {
    clearTimeout(timeout);
  }

  throw new PreviewError("fetch_failed");
}

async function safeImageUrl(value: string | null, baseUrl: URL): Promise<string | null> {
  if (!value) return null;
  try {
    const imageUrl = new URL(value, baseUrl);
    await assertSafeUrl(imageUrl);
    return imageUrl.toString();
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "invalid_url" });

  try {
    const body = await request.json().catch(() => null) as { url?: unknown } | null;
    if (!body || typeof body.url !== "string" || body.url.length > 2048) {
      throw new PreviewError("invalid_url");
    }

    let requestedUrl: URL;
    try {
      requestedUrl = new URL(body.url.trim());
    } catch {
      throw new PreviewError("invalid_url");
    }

    const { html, finalUrl } = await fetchHtml(requestedUrl);
    const meta = extractMeta(html);
    const product = extractProductJsonLd(html);
    const offer = firstOffer(product?.offers);
    const priceSpecification = firstOffer(offer?.priceSpecification);

    const title = decodeHtml(
      firstString(product?.name)
        ?? meta.get("og:title")
        ?? meta.get("twitter:title")
        ?? html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ?? "",
    ).slice(0, 160) || null;

    const imageCandidate = firstString(product?.image)
      ?? meta.get("og:image:secure_url")
      ?? meta.get("og:image")
      ?? meta.get("twitter:image")
      ?? meta.get("twitter:image:src")
      ?? null;

    const price = parsePrice(
      offer?.price
        ?? offer?.lowPrice
        ?? priceSpecification?.price
        ?? meta.get("product:price:amount")
        ?? meta.get("og:price:amount"),
    );

    const currency = decodeHtml(String(
      offer?.priceCurrency
        ?? priceSpecification?.priceCurrency
        ?? meta.get("product:price:currency")
        ?? meta.get("og:price:currency")
        ?? "",
    )).toUpperCase() || null;

    const siteName = decodeHtml(
      meta.get("og:site_name") ?? finalUrl.hostname.replace(/^www\./, ""),
    ).slice(0, 120) || null;

    const imageUrl = await safeImageUrl(imageCandidate, finalUrl);
    if (!title && !imageUrl && price === null) throw new PreviewError("no_metadata");

    return json({
      ok: true,
      title,
      imageUrl,
      price,
      currency,
      siteName,
      resolvedUrl: finalUrl.toString(),
    });
  } catch (error) {
    const code = error instanceof PreviewError ? error.code : "fetch_failed";
    return json({ ok: false, error: code });
  }
});
