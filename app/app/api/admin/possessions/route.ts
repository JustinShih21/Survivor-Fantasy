import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** GET: admin-only; return all contestant_possessions with contestant names */
export async function GET() {
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

  const [possessionsRes, contestantsRes] = await Promise.all([
    admin.from("contestant_possessions").select("contestant_id, idols, advantages, clues"),
    admin.from("contestants").select("id, name").order("id"),
  ]);

  if (possessionsRes.error) {
    return NextResponse.json({ error: possessionsRes.error.message }, { status: 500 });
  }
  if (contestantsRes.error) {
    return NextResponse.json({ error: contestantsRes.error.message }, { status: 500 });
  }

  const byId = new Map(
    (possessionsRes.data ?? []).map((r) => [
      r.contestant_id,
      { idols: r.idols, advantages: r.advantages, clues: r.clues },
    ])
  );

  const list = (contestantsRes.data ?? []).map((c) => {
    const p = byId.get(c.id) ?? { idols: 0, advantages: 0, clues: 0 };
    return {
      contestant_id: c.id,
      name: c.name,
      idols: p.idols,
      advantages: p.advantages,
      clues: p.clues,
    };
  });

  return NextResponse.json(list);
}

/** PATCH: admin-only; upsert one or many. Body: { updates: { contestant_id, idols, advantages, clues }[] } */
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

  try {
    const body = (await request.json()) as {
      updates?: { contestant_id: string; idols: number; advantages: number; clues: number }[];
    };
    const updates = body.updates ?? [];
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates array required" }, { status: 400 });
    }

    for (const u of updates) {
      const idols = Math.max(0, Number(u.idols) || 0);
      const advantages = Math.max(0, Number(u.advantages) || 0);
      const clues = Math.max(0, Number(u.clues) || 0);
      if (!u.contestant_id || typeof u.contestant_id !== "string") {
        return NextResponse.json({ error: "contestant_id required" }, { status: 400 });
      }
      const { error: upsertErr } = await admin
        .from("contestant_possessions")
        .upsert(
          { contestant_id: u.contestant_id, idols, advantages, clues },
          { onConflict: "contestant_id" }
        );
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
