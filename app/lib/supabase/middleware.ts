import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const publicPaths = ["/login", "/signup", "/auth/callback", "/onboarding", "/privacy", "/terms"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  const isApi = pathname.startsWith("/api/");

  // #region agent log
  if (!user && !isPublic && !isApi) {
    fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'middleware.ts:redirect',message:'middleware redirect to login',data:{pathname,hasUser:!!user},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  } else if (user && pathname === "/") {
    fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'middleware.ts:allow',message:'middleware allow /',data:{pathname,hasUser:!!user},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  }
  // #endregion

  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    const idsEnv = process.env.ADMIN_USER_IDS;
    const ids = idsEnv ? idsEnv.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (!ids.includes(user.id)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
