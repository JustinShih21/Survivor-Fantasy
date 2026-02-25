import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // #region agent log
  if (error) {
    fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'api/auth/login/route.ts',message:'server login error',data:{message:error.message},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  } else {
    fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'api/auth/login/route.ts',message:'server login success',data:{hasSession:!!data?.session},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  }
  // #endregion

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (!data.session) {
    return NextResponse.json(
      { error: "No session returned" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
