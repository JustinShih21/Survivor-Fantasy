import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/home-content
 * Returns published home page content for the public (no auth).
 * Ordered by sort_order, then created_at. Does not include body.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_page_content")
    .select("id, title, slug, excerpt, link_url, image_url, sort_order")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    // If table is missing (migration not run), return empty array so home page still renders.
    const isMissingTable = error.message?.includes("relation") && error.message?.includes("does not exist");
    if (isMissingTable) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
