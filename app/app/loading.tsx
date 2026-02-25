export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div
        className="w-10 h-10 border-[3px] border-stone-600 border-t-orange-500 rounded-full animate-spin"
        aria-hidden
      />
      <span className="text-stone-300/80 text-sm tracking-wide animate-pulse">
        Loading...
      </span>
    </div>
  );
}
