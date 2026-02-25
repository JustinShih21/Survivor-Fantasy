import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/article/[slug]
 * Returns a single published article by slug, including body (for full page).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_page_content")
    .select("id, title, slug, excerpt, body, link_url, image_url, created_at")
    .eq("published", true)
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
