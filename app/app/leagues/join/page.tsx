"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinLeaguePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    if (!code || code.length !== 6) {
      queueMicrotask(() => {
        setStatus("error");
        setMessage("Invalid invite link — missing or invalid code.");
      });
      return;
    }

    fetch("/api/leagues/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setLeagueName(data.league_name ?? "");
          setMessage(`You've joined "${data.league_name}"!`);
        } else if (res.status === 409) {
          setStatus("success");
          setLeagueName(data.league_name ?? "");
          setMessage(data.error ?? "You're already in this league.");
        } else {
          setStatus("error");
          setMessage(data.error ?? "Failed to join league.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [code]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-100">Join League</h1>

      <div className={`p-6 rounded-xl text-center ${status === "loading" ? "" : status === "success" ? "bg-emerald-950/30 border border-emerald-700/40" : "bg-red-950/30 border border-red-800/40"}`}>
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-8 h-8 border-[3px] border-stone-600 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-stone-300">Joining league...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className={`text-lg font-medium ${status === "success" ? "text-emerald-300" : "text-red-300"}`}>
              {message}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/leagues"
                className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold transition-colors min-h-[44px]"
              >
                Go to Leagues
              </Link>
              {status === "error" && (
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="px-6 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-medium transition-colors min-h-[44px]"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
