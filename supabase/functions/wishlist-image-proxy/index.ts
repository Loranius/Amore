import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_IMAGE_BYTES = 8_000_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

class ProxyError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function jsonError(error: ProxyError): Response {
  return new Response(JSON.stringify({ error: error.code }), {
    status: error.status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) =>
    !Number.isInteger(part) || part < 0 || part > 255)) return false;
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
  if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
    throw new ProxyError(400, "invalid_url");
  }
  if (candidate.username || candidate.password) throw new ProxyError(400, "blocked_url");
  if (candidate.port && candidate.port !== "80" && candidate.port !== "443") {
    throw new ProxyError(400, "blocked_url");
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
    throw new ProxyError(400, "blocked_url");
  }
  if (isBlockedIp(hostname)) throw new ProxyError(400, "blocked_url");
  if (hostname.includes(":")) return;

  const resolved: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      resolved.push(...await Deno.resolveDns(hostname, type));
    } catch {
      // A host may expose only one address family.
    }
  }
  if (resolved.length === 0) throw new ProxyError(502, "fetch_failed");
  if (resolved.some(isBlockedIp)) throw new ProxyError(400, "blocked_url");
}

async function readLimitedBytes(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new ProxyError(413, "image_too_large");
  if (!response.body) throw new ProxyError(502, "empty_image");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new ProxyError(413, "image_too_large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function fetchImage(initialUrl: URL): Promise<{ bytes: Uint8Array; contentType: string }> {
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
          "Accept": "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8",
          "User-Agent": "AmoreWishlistImageProxy/1.0",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) {
          throw new ProxyError(502, "fetch_failed");
        }
        currentUrl = new URL(location, currentUrl);
        continue;
      }

      if (!response.ok) throw new ProxyError(502, "fetch_failed");
      const contentType = (response.headers.get("content-type") ?? "")
        .split(";", 1)[0]!
        .trim()
        .toLowerCase();
      if (!ALLOWED_TYPES.has(contentType)) throw new ProxyError(415, "unsupported_image");
      return { bytes: await readLimitedBytes(response), contentType };
    }
  } catch (error) {
    if (error instanceof ProxyError) throw error;
    throw new ProxyError(502, "fetch_failed");
  } finally {
    clearTimeout(timeout);
  }

  throw new ProxyError(502, "fetch_failed");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonError(new ProxyError(405, "method_not_allowed"));

  try {
    const body = await request.json().catch(() => null) as { url?: unknown } | null;
    if (!body || typeof body.url !== "string" || body.url.length > 2048) {
      throw new ProxyError(400, "invalid_url");
    }
    let url: URL;
    try {
      url = new URL(body.url.trim());
    } catch {
      throw new ProxyError(400, "invalid_url");
    }

    const image = await fetchImage(url);
    return new Response(image.bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": image.contentType,
        "Content-Length": String(image.bytes.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error instanceof ProxyError
      ? error
      : new ProxyError(500, "internal_error"));
  }
});
