import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-4">
      <div className="tribal-bg" aria-hidden />
      <div className="relative z-10 text-center">
        <h1 className="text-2xl font-bold text-stone-100">Page not found</h1>
        <p className="text-stone-400 mt-2">This page doesn’t exist or has been moved.</p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold transition-colors"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
