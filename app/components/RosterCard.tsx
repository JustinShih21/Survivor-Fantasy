"use client";

import Link from "next/link";
import type { ContestantPointsSummary } from "@/lib/scoring";
import { formatDisplayName } from "@/lib/formatName";
import { TribalRibbon } from "./TribalPattern";
import { getTribeDisplayName } from "@/lib/tribes";
import type { PlayerDetailTraits } from "./PlayerDetailModal";
import { VOTED_OUT_BADGE_CLASS, VOTED_OUT_BADGE_TEXT, VOTED_OUT_IMAGE_CLASS } from "@/lib/statusStyles";
import { CARD_CONTENT_MIN_H, CARD_MIN_WIDTH, CARD_WIDTH, PHOTO_HEIGHT } from "@/lib/cardDimensions";

interface RosterCardProps {
  contestantId: string;
  name: string;
  photoUrl: string;
  rawPhotoUrl?: string | undefined;
  addedAtEpisode: number;
  isWildCard?: boolean;
  breakdown: ContestantPointsSummary;
  weekPoints: number;
  isVotedOut?: boolean;
  isTransferredOut?: boolean;
  tribe?: string | null;
  isCaptain?: boolean;
  traits?: PlayerDetailTraits;
}

export function RosterCard({
  name,
  photoUrl,
  rawPhotoUrl,
  contestantId,
  addedAtEpisode,
  isWildCard,
  breakdown,
  weekPoints,
  isVotedOut,
  isTransferredOut: _isTransferredOut,
  tribe,
  isCaptain,
  traits,
}: RosterCardProps) {
  return (
    <div
        className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} flex flex-col rounded-xl overflow-hidden texture-sandy stone-outline bg-stone-800/90`}
      >
        <div className={`${PHOTO_HEIGHT} w-full overflow-hidden bg-stone-800/50 relative shrink-0`}>
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent z-[1] pointer-events-none" />
          <img
            src={photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover object-top ${isVotedOut ? VOTED_OUT_IMAGE_CLASS : ""}`}
          />
        </div>
        {tribe && <TribalRibbon tribeId={tribe} title={getTribeDisplayName(tribe)} />}
        <div className={`p-2 flex flex-col gap-0.5 items-center text-center shrink-0 ${CARD_CONTENT_MIN_H}`}>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <span className="font-bold text-stone-100 text-sm">{formatDisplayName(name)}</span>
            {isCaptain && (
              <span className="text-orange-400 text-xs shrink-0" title="Captain (2× points)">★</span>
            )}
            {isWildCard && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-600/60 text-stone-100">
                Wild
              </span>
            )}
            {isVotedOut && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${VOTED_OUT_BADGE_CLASS}`}>
                {VOTED_OUT_BADGE_TEXT}
              </span>
            )}
          </div>
          <span className="text-orange-400 font-semibold text-sm">
            {weekPoints} pts
          </span>
          <Link
            href={`/points/player/${contestantId}`}
            className="mt-1 text-xs px-2 py-1 rounded-lg bg-stone-700/80 text-stone-200 hover:bg-stone-600/80 transition-colors inline-block"
          >
            Get info
          </Link>
        </div>
      </div>
  );
}
