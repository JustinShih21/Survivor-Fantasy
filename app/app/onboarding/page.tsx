"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TRIBE_NAME_MIN = 3;
const TRIBE_NAME_MAX = 24;

export default function OnboardingPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tribeName, setTribeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            router.push("/");
          } else {
            setChecking(false);
          }
        });
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedTribe = tribeName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError("First name and last name are required");
      return;
    }

    if (
      trimmedTribe.length < TRIBE_NAME_MIN ||
      trimmedTribe.length > TRIBE_NAME_MAX
    ) {
      setError(
        `Tribe name must be ${TRIBE_NAME_MIN}-${TRIBE_NAME_MAX} characters`
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: trimmedFirst,
          last_name: trimmedLast,
          tribe_name: trimmedTribe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create profile");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <span className="text-stone-300/80">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="tribal-bg" aria-hidden />
      <div className="fire-glimmer" aria-hidden />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-stone-100 tracking-wide">
            Welcome, Survivor
          </h1>
          <p className="text-stone-400 mt-2 text-sm">
            Set up your profile and name your tribe
          </p>
        </div>

        <div className="p-8 rounded-2xl texture-sandy bg-stone-800/90 stone-outline shadow-xl space-y-6">
          <h2 className="text-xl font-semibold text-stone-100 text-center">
            Name Your Tribe
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/50 border border-red-700/50 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-stone-300 mb-1"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                  placeholder="Jeff"
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-stone-300 mb-1"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                  placeholder="Probst"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="tribeName"
                className="block text-sm font-medium text-stone-300 mb-1"
              >
                Tribe Name
              </label>
              <input
                id="tribeName"
                type="text"
                value={tribeName}
                onChange={(e) => setTribeName(e.target.value)}
                required
                minLength={TRIBE_NAME_MIN}
                maxLength={TRIBE_NAME_MAX}
                className="w-full px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
                placeholder="The Blindsiders"
              />
              <p className="text-xs text-stone-500 mt-1">
                {TRIBE_NAME_MIN}-{TRIBE_NAME_MAX} characters. This cannot be
                changed later.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold transition-colors min-h-[44px]"
            >
              {loading ? "Creating..." : "Create Tribe"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
