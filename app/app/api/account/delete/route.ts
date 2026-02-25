import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const admin = createAdminClient();

    await admin.from("tribe_entries").delete().eq("user_id", userId);
    await admin.from("captain_picks").delete().eq("user_id", userId);
    await admin.from("league_invites").delete().eq("invited_by", userId);
    await admin.from("leagues").delete().eq("created_by", userId);

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error("Auth deleteUser failed:", deleteUserError);
      return NextResponse.json(
        { error: deleteUserError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Account deletion failed";
    console.error("Account deletion error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
