"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // #region agent log
    fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'login/page.tsx:handleLogin',message:'handleLogin started (api)',data:{hasEmail:!!email},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      // #region agent log
      fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'login/page.tsx:after fetch',message:'after api auth/login',data:{ok:res.ok,status:res.status,error:data?.error},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      if (res.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'login/page.tsx:before redirect',message:'redirecting to /',data:{},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        window.location.href = "/";
        return;
      }

      setError(data?.error ?? "Login failed. Please try again.");
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'login/page.tsx:catch',message:'catch block',data:{errMessage:err instanceof Error?err.message:String(err)},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      // #region agent log
      fetch('http://127.0.0.1:7497/ingest/b42e58e2-caf9-48da-b647-cabab44684f1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64e5fa'},body:JSON.stringify({sessionId:'64e5fa',location:'login/page.tsx:finally',message:'finally block',data:{},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      setLoading(false);
    }
  };

  const handleCancelLogin = () => {
    setLoading(false);
    setError(null);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="tribal-bg" aria-hidden />
      <div className="fire-glimmer" aria-hidden />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-stone-100 tracking-wide">
            Survivor Fantasy Team
          </h1>
          <p className="text-stone-400 mt-2 text-sm">
            Outwit &middot; Outplay &middot; Outlast
          </p>
        </div>

        <div className="p-8 rounded-2xl texture-sandy bg-stone-800/90 stone-outline shadow-xl space-y-6">
          <h2 className="text-xl font-semibold text-stone-100 text-center">
            Log In
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/50 border border-red-700/50 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-300 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-stone-300 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold transition-colors min-h-[44px]"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
            {loading && (
              <p className="text-center text-sm mt-2">
                <button
                  type="button"
                  onClick={handleCancelLogin}
                  className="text-orange-400 hover:text-orange-300 underline"
                >
                  Cancel
                </button>
              </p>
            )}
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-600/50" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-stone-800 text-stone-400">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full px-6 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          <p className="text-center text-sm text-stone-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-orange-400 hover:text-orange-300 font-medium"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
