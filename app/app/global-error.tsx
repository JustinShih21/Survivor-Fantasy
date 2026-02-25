"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body className="antialiased bg-black text-stone-100 min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-stone-400 mt-2 text-sm">
          The app hit an error. Try refreshing the page.
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold transition-colors"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
