"use client";

import { getDisplayPhotoUrl } from "@/lib/photo";
import { formatDisplayName } from "@/lib/formatName";
import { TribalRibbon } from "./TribalPattern";
import { getTribeDisplayName } from "@/lib/tribes";
import { CARD_CONTENT_MIN_H, CARD_MIN_WIDTH, CARD_WIDTH, PHOTO_HEIGHT } from "@/lib/cardDimensions";

interface Contestant {
  id: string;
  name: string;
  starting_tribe: string;
  pre_merge_price: number;
  photo_url?: string;
}

interface ContestantCardProps {
  contestant: Contestant;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function ContestantCard({
  contestant,
  selected,
  onToggle,
  disabled,
}: ContestantCardProps) {
  const baseStyles = selected
    ? "border-2 border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-400/50 shadow-emerald-500/20"
    : "stone-outline bg-stone-800/90 texture-sandy hover:opacity-90";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} flex flex-col rounded-xl overflow-hidden transition-colors touch-manipulation ${baseStyles} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className={`${PHOTO_HEIGHT} w-full overflow-hidden bg-stone-800/50 relative shrink-0`}>
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent z-[1] pointer-events-none" />
        <img
          src={getDisplayPhotoUrl(contestant.photo_url, contestant.id)}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-top"
        />
      </div>
      <TribalRibbon tribeId={contestant.starting_tribe} />
      <div className={`p-2 flex flex-col gap-0.5 items-center text-center shrink-0 ${CARD_CONTENT_MIN_H}`}>
        <span className="font-bold text-stone-100 text-sm">
          {formatDisplayName(contestant.name)}
        </span>
        <span className="text-xs text-stone-300/80">{getTribeDisplayName(contestant.starting_tribe)}</span>
        <span className="font-semibold text-orange-400 text-sm">
          ${contestant.pre_merge_price.toLocaleString()}
        </span>
      </div>
    </button>
  );
}
