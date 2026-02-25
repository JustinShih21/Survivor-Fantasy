"use client";

interface PossessionIconsProps {
  idols: number;
  advantages: number;
  clues: number;
  size?: "sm" | "xs";
}

function IdolIcon({ size }: { size: "sm" | "xs" }) {
  const s = size === "sm" ? 14 : 12;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className="text-orange-400 shrink-0" aria-hidden>
      <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" />
    </svg>
  );
}

function AdvantageIcon({ size }: { size: "sm" | "xs" }) {
  const s = size === "sm" ? 14 : 12;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-300 shrink-0" aria-hidden>
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
    </svg>
  );
}

function ClueIcon({ size }: { size: "sm" | "xs" }) {
  const s = size === "sm" ? 14 : 12;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-200 shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21L16.65 16.65" />
    </svg>
  );
}

export function PossessionIcons({ idols, advantages, clues, size = "sm" }: PossessionIconsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Possessions">
      <span className="flex items-center gap-0.5" title="Idols">
        <IdolIcon size={size} />
        <span className="text-stone-200/90 text-xs tabular-nums">{idols}</span>
      </span>
      <span className="flex items-center gap-0.5" title="Advantages">
        <AdvantageIcon size={size} />
        <span className="text-stone-200/90 text-xs tabular-nums">{advantages}</span>
      </span>
      <span className="flex items-center gap-0.5" title="Clues">
        <ClueIcon size={size} />
        <span className="text-stone-200/90 text-xs tabular-nums">{clues}</span>
      </span>
    </div>
  );
}
