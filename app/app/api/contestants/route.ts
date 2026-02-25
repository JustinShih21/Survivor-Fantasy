import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import contestantsSeed from "@/seed/contestants.json";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contestants")
      .select("id, name, starting_tribe, pre_merge_price, photo_url, physicality, cognition, strategy, influence, resilience")
      .order("id");

    if (error) {
      const fallbackRes = await supabase
        .from("contestants")
        .select("id, name, starting_tribe, pre_merge_price, photo_url")
        .order("id");
      if (fallbackRes.error || !fallbackRes.data?.length) {
        return NextResponse.json(contestantsSeed as Record<string, unknown>[], {
          headers: { "Cache-Control": "no-store" },
        });
      }
      return NextResponse.json(fallbackRes.data, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(contestantsSeed as Record<string, unknown>[], {
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(contestantsSeed as Record<string, unknown>[], {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
