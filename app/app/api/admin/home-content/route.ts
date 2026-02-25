import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("home_page_content")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      slug?: string | null;
      excerpt?: string | null;
      body?: string | null;
      link_url?: string | null;
      image_url?: string | null;
      sort_order?: number;
      published?: boolean;
    };
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const row = {
      title: body.title,
      slug: body.slug ?? null,
      excerpt: body.excerpt ?? null,
      body: body.body ?? null,
      link_url: body.link_url ?? null,
      image_url: body.image_url ?? null,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
      published: body.published !== false,
      updated_at: new Date().toISOString(),
    };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("home_page_content")
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
