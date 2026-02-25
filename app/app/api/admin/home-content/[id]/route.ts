import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.slug !== undefined) updates.slug = body.slug ?? null;
    if (body.excerpt !== undefined) updates.excerpt = body.excerpt ?? null;
    if (body.body !== undefined) updates.body = body.body ?? null;
    if (body.link_url !== undefined) updates.link_url = body.link_url ?? null;
    if (body.image_url !== undefined) updates.image_url = body.image_url ?? null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.published !== undefined) updates.published = body.published;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("home_page_content")
      .update(updates)
      .eq("id", id)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("home_page_content").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
