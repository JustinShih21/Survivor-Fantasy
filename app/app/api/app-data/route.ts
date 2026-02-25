import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";

/**
 * GET /api/app-data
 * Returns scores, contestants, season, and captain in one response to reduce
 * client round-trips when loading pages that need this shared data.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    const origin = new URL(request.url).origin;
    const cookie = request.headers.get("cookie") ?? "";
    const authHeaders: HeadersInit = cookie ? { cookie } : {};

    const [scoresRes, contestantsRes, seasonRes, captainRes] = await Promise.all([
      fetch(`${origin}/api/scores`, { headers: authHeaders }),
      fetch(`${origin}/api/contestants`),
      fetch(`${origin}/api/season`),
      fetch(`${origin}/api/captain`, { headers: authHeaders }),
    ]);

    if (!scoresRes.ok || !captainRes.ok) {
      const status = !scoresRes.ok ? scoresRes.status : captainRes.status;
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: status === 401 ? 401 : 500 }
      );
    }

    const [scores, contestants, season, captain] = await Promise.all([
      scoresRes.json(),
      contestantsRes.json(),
      seasonRes.json(),
      captainRes.json(),
    ]);

    const admin = auth ? await isAdmin(auth.supabase) : false;

    return NextResponse.json({
      scores,
      contestants: Array.isArray(contestants) ? contestants : [],
      season,
      captain,
      isAdmin: admin,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
