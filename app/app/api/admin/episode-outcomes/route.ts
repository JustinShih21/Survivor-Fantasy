/**
 * Admin API for episode outcomes (who was voted out per episode).
 * GET: return voted_out_ids per episode for 1..current_episode (or through query).
 * PATCH: set voted_out_ids for an episode (upsert episode_outcomes row).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractVotedOutIds } from "@/lib/votedOut";

export const dynamic = "force-dynamic";

function getAdminClient() {
  try {
    return createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) {
      return null;
    }
    throw e;
  }
}

function normalizeVotedOutBody(value: unknown): string[] | null {
  if (value == null) return [];
  if (typeof value === "string") {
    const id = value.trim();
    return id ? [id] : [];
  }
  if (!Array.isArray(value)) return null;

  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const id = item.trim();
    if (!id) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** GET: return { outcomes: { episode_id, voted_out_ids: contestant_id[], voted_out: contestant_id | null }[], current_episode } */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const through = parseInt(searchParams.get("through") ?? "", 10);
  const maxEpisodes = 18;

  const [outcomesRes, seasonRes] = await Promise.all([
    admin
      .from("episode_outcomes")
      .select("episode_id, outcome")
      .order("episode_id"),
    admin
      .from("season_state")
      .select("current_episode")
      .eq("id", "current")
      .single(),
  ]);

  if (outcomesRes.error) {
    return NextResponse.json({ error: outcomesRes.error.message }, { status: 500 });
  }

  const currentEpisode = Math.max(
    1,
    (seasonRes.data as { current_episode?: number } | null)?.current_episode ?? 1
  );
  const lastEpisode = Number.isNaN(through) || through < 1
    ? Math.max(currentEpisode, maxEpisodes)
    : Math.min(through, maxEpisodes);

  const byEp = new Map<number, string[]>();
  for (let ep = 1; ep <= lastEpisode; ep++) {
    byEp.set(ep, []);
  }
  for (const row of outcomesRes.data ?? []) {
    const epId = row.episode_id as number;
    const votedOutIds = extractVotedOutIds(row.outcome as Record<string, unknown>);
    if (epId >= 1 && epId <= lastEpisode) {
      byEp.set(epId, votedOutIds);
    }
  }

  const outcomes = Array.from(byEp.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([episode_id, voted_out_ids]) => ({
      episode_id,
      voted_out_ids,
      voted_out: voted_out_ids[0] ?? null,
    }));

  return NextResponse.json({ outcomes, current_episode: currentEpisode });
}

/** PATCH: body { episode_id: number, voted_out_ids?: string[], voted_out?: string | null }; upsert episode_outcomes */
export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  let body: {
    episode_id?: number;
    voted_out?: string | null;
    voted_out_ids?: string[] | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const episode_id = body.episode_id != null ? Number(body.episode_id) : NaN;
  if (!Number.isInteger(episode_id) || episode_id < 1 || episode_id > 18) {
    return NextResponse.json(
      { error: "episode_id must be an integer 1–18" },
      { status: 400 }
    );
  }

  const hasIdsField = body.voted_out_ids !== undefined;
  const hasLegacyField = body.voted_out !== undefined;

  if (!hasIdsField && !hasLegacyField) {
    return NextResponse.json(
      { error: "Provide voted_out_ids (array) or voted_out (string|null)" },
      { status: 400 }
    );
  }

  const votedOutIds = hasIdsField
    ? normalizeVotedOutBody(body.voted_out_ids)
    : normalizeVotedOutBody(body.voted_out ?? null);
  if (votedOutIds == null) {
    return NextResponse.json(
      { error: "voted_out_ids must be an array of contestant id strings (or null)" },
      { status: 400 }
    );
  }

  const { data: existing } = await admin
    .from("episode_outcomes")
    .select("phase, outcome")
    .eq("episode_id", episode_id)
    .single();

  const phase =
    (existing as { phase?: string } | null)?.phase ?? "pre_merge";
  const existingOutcome = (existing as { outcome?: Record<string, unknown> } | null)?.outcome ?? {};
  const outcome: Record<string, unknown> = { ...existingOutcome };
  if (votedOutIds.length === 0) {
    delete outcome.voted_out;
    delete outcome.voted_out_ids;
  } else {
    outcome.voted_out_ids = votedOutIds;
    outcome.voted_out = votedOutIds[0];
  }

  const { error } = await admin
    .from("episode_outcomes")
    .upsert(
      { episode_id, phase, outcome },
      { onConflict: "episode_id", ignoreDuplicates: false }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    episode_id,
    voted_out_ids: votedOutIds,
    voted_out: votedOutIds[0] ?? null,
  });
}
