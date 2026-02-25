"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "At least 1 uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "At least 1 lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "At least 1 number", test: (p: string) => /\d/.test(p) },
  { key: "symbol", label: "At least 1 symbol (!@#$%^&*...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function PasswordStrengthBar({ password }: { password: string }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const strength = passed <= 2 ? "weak" : passed <= 4 ? "medium" : "strong";
  const pct = (passed / PASSWORD_RULES.length) * 100;
  const color =
    strength === "weak"
      ? "bg-red-500"
      : strength === "medium"
        ? "bg-yellow-500"
        : "bg-emerald-500";
  const label =
    strength === "weak" ? "Weak" : strength === "medium" ? "Medium" : "Strong";

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-stone-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${strength === "weak" ? "text-red-400" : strength === "medium" ? "text-yellow-400" : "text-emerald-400"}`}>
          {label}
        </span>
      </div>
      <ul className="space-y-1">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li key={rule.key} className={`text-xs flex items-center gap-1.5 ${met ? "text-emerald-400" : "text-stone-400"}`}>
              <span>{met ? "✓" : "○"}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allRulesPassed = useMemo(
    () => PASSWORD_RULES.every((r) => r.test(password)),
    [password]
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allRulesPassed) {
      setError("Password does not meet all requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!acceptedTerms) {
      setError("You must accept the Terms & Conditions and Privacy Policy");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  };

  const handleGoogleSignup = async () => {
    if (!acceptedTerms) {
      setError("You must accept the Terms & Conditions and Privacy Policy");
      return;
    }
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
            Create Account
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/50 border border-red-700/50 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-300 mb-1">
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
              <label htmlFor="password" className="block text-sm font-medium text-stone-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                placeholder="••••••••"
              />
              <PasswordStrengthBar password={password} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-stone-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                placeholder="••••••••"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 rounded border-stone-600 bg-stone-900 text-orange-500 focus:ring-orange-500/50"
              />
              <span className="text-xs text-stone-300">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-orange-400 hover:text-orange-300 underline">
                  Terms &amp; Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="text-orange-400 hover:text-orange-300 underline">
                  Privacy Policy
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !allRulesPassed || !acceptedTerms}
              className="w-full px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold transition-colors min-h-[44px]"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
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
            onClick={handleGoogleSignup}
            type="button"
            className="w-full px-6 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign up with Google
          </button>

          <p className="text-center text-sm text-stone-400">
            Already have an account?{" "}
            <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
