import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } as HeadersInit };

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("season_state")
    .select("current_episode")
    .eq("id", "current")
    .single();

  if (error) {
    return NextResponse.json({ current_episode: 1 }, { status: 200, ...NO_STORE });
  }

  return NextResponse.json(
    { current_episode: data?.current_episode ?? 1 },
    { status: 200, ...NO_STORE }
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const admin = await isAdmin(auth.supabase);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { current_episode?: number };
    const episode = body.current_episode ?? 1;

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
      .from("season_state")
      .upsert({ id: "current", current_episode: episode, updated_at: new Date().toISOString() }, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ current_episode: episode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
