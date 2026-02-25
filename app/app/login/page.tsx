"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        window.location.href = "/";
        return;
      }

      setError(data?.error ?? "Login failed. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLogin = () => {
    setLoading(false);
    setError(null);
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
