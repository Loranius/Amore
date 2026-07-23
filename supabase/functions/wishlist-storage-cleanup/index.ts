import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_LIMIT = 500;
const DELETE_CHUNK_SIZE = 100;

type CleanupCandidate = {
  bucket_id: "wishlist-memories" | "wishlist-photos";
  object_name: string;
  size_bytes: number | string | null;
  created_at: string;
};

type CleanupBody = {
  dryRun?: boolean;
};

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ ok: false, error: "server_not_configured" }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) {
    return response({ ok: false, error: "not_authenticated" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return response({ ok: false, error: "not_authenticated" }, 401);
  }

  const body = await request.json().catch(() => ({})) as CleanupBody;
  const dryRun = body.dryRun === true;

  const { data: claimedRun, error: claimError } = await userClient.rpc(
    "claim_wishlist_storage_cleanup",
  );
  if (claimError) {
    console.error("[wishlist-storage-cleanup] claim failed", claimError);
    return response({ ok: false, error: "claim_failed" }, 500);
  }

  const runId = typeof claimedRun === "number" ? claimedRun : Number(claimedRun ?? 0);
  if (!Number.isSafeInteger(runId) || runId <= 0) {
    return response({ ok: true, status: "skipped", reason: "recent_run" });
  }

  let memoriesDeleted = 0;
  let photosDeleted = 0;
  let bytesDeleted = 0;

  try {
    const cutoff = new Date(Date.now() - ORPHAN_AGE_MS).toISOString();
    const { data, error } = await admin.rpc("get_wishlist_storage_cleanup_candidates", {
      p_cutoff: cutoff,
      p_limit: CANDIDATE_LIMIT,
    });
    if (error) throw error;

    const candidates = Array.isArray(data) ? data as CleanupCandidate[] : [];

    if (!dryRun) {
      for (const bucketId of ["wishlist-memories", "wishlist-photos"] as const) {
        const bucketCandidates = candidates.filter((item) => item.bucket_id === bucketId);
        for (const group of chunks(bucketCandidates, DELETE_CHUNK_SIZE)) {
          const paths = group.map((item) => item.object_name);
          const { error: deleteError } = await admin.storage.from(bucketId).remove(paths);
          if (deleteError) throw deleteError;

          const deletedCount = group.length;
          const deletedBytes = group.reduce(
            (sum, item) => sum + Math.max(Number(item.size_bytes ?? 0) || 0, 0),
            0,
          );

          if (bucketId === "wishlist-memories") memoriesDeleted += deletedCount;
          else photosDeleted += deletedCount;
          bytesDeleted += deletedBytes;
        }
      }
    }

    const candidateMemories = candidates.filter(
      (item) => item.bucket_id === "wishlist-memories",
    ).length;
    const candidatePhotos = candidates.filter(
      (item) => item.bucket_id === "wishlist-photos",
    ).length;
    const candidateBytes = candidates.reduce(
      (sum, item) => sum + Math.max(Number(item.size_bytes ?? 0) || 0, 0),
      0,
    );

    const { error: finishError } = await admin.rpc("finish_wishlist_storage_cleanup", {
      p_run_id: runId,
      p_status: dryRun ? "dry_run" : "succeeded",
      p_memories_deleted: dryRun ? candidateMemories : memoriesDeleted,
      p_photos_deleted: dryRun ? candidatePhotos : photosDeleted,
      p_bytes_deleted: dryRun ? candidateBytes : bytesDeleted,
      p_error_summary: null,
    });
    if (finishError) throw finishError;

    return response({
      ok: true,
      status: dryRun ? "dry_run" : "completed",
      runId,
      memoriesDeleted: dryRun ? candidateMemories : memoriesDeleted,
      photosDeleted: dryRun ? candidatePhotos : photosDeleted,
      bytesDeleted: dryRun ? candidateBytes : bytesDeleted,
      cutoff,
      capped: candidates.length >= CANDIDATE_LIMIT,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[wishlist-storage-cleanup] failed", error);

    const { error: finishError } = await admin.rpc("finish_wishlist_storage_cleanup", {
      p_run_id: runId,
      p_status: "failed",
      p_memories_deleted: memoriesDeleted,
      p_photos_deleted: photosDeleted,
      p_bytes_deleted: bytesDeleted,
      p_error_summary: message,
    });
    if (finishError) console.error("[wishlist-storage-cleanup] finish failed", finishError);

    return response({ ok: false, error: "cleanup_failed", runId }, 500);
  }
});
