import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, tribe_name, created_at")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { first_name, last_name, tribe_name } = body as {
    first_name?: string;
    last_name?: string;
    tribe_name?: string;
  };

  if (!first_name?.trim() || !last_name?.trim() || !tribe_name?.trim()) {
    return NextResponse.json(
      { error: "First name, last name, and tribe name are required" },
      { status: 400 }
    );
  }

  const trimmedTribe = tribe_name.trim();

  if (trimmedTribe.length < 3 || trimmedTribe.length > 24) {
    return NextResponse.json(
      { error: "Tribe name must be 3-24 characters" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Profile already exists" },
      { status: 409 }
    );
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    tribe_name: trimmedTribe,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "That tribe name is already taken" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { first_name, last_name, tribe_name } = body as {
    first_name?: string;
    last_name?: string;
    tribe_name?: string;
  };

  const updates: { first_name?: string; last_name?: string; tribe_name?: string } = {};

  if (first_name !== undefined) {
    const trimmed = first_name?.trim() ?? "";
    if (!trimmed) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      );
    }
    updates.first_name = trimmed;
  }
  if (last_name !== undefined) {
    const trimmed = last_name?.trim() ?? "";
    if (!trimmed) {
      return NextResponse.json(
        { error: "Last name is required" },
        { status: 400 }
      );
    }
    updates.last_name = trimmed;
  }
  if (tribe_name !== undefined) {
    const trimmed = tribe_name.trim();
    if (trimmed.length < 3 || trimmed.length > 24) {
      return NextResponse.json(
        { error: "Tribe name must be 3-24 characters" },
        { status: 400 }
      );
    }
    updates.tribe_name = trimmed;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("first_name, last_name, tribe_name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That tribe name is already taken" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile });
}
