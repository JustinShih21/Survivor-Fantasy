"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-4">
      <div className="tribal-bg" aria-hidden />
      <div className="relative z-10 text-center max-w-md">
        <h1 className="text-2xl font-bold text-stone-100">Something went wrong</h1>
        <p className="text-stone-400 mt-2 text-sm">
          This page hit an error. You can try again or go back home.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl bg-stone-600 hover:bg-stone-500 text-stone-100 font-medium transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
