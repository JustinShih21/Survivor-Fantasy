"use client";

import { PossessionIcons } from "./PossessionIcons";
import { TribalRibbon } from "./TribalPattern";
import { formatDisplayName } from "@/lib/formatName";
import { getTribeDisplayName } from "@/lib/tribes";
import { VOTED_OUT_BADGE_CLASS, VOTED_OUT_BADGE_TEXT, VOTED_OUT_IMAGE_CLASS } from "@/lib/statusStyles";
import { CARD_CONTENT_MIN_H, CARD_MIN_WIDTH, CARD_WIDTH, PHOTO_HEIGHT } from "@/lib/cardDimensions";

interface Possessions {
  idols: number;
  advantages: number;
  clues: number;
}

interface PlayerCardProps {
  contestantId: string;
  name: string;
  photoUrl: string;
  isCaptain?: boolean;
  size?: "large" | "small";
  isWildCard?: boolean;
  addedAtEpisode?: number;
  /** Pick Team mode: show tribe and possessions, no points/price */
  currentTribe?: string | null;
  possessions?: Possessions;
  isVotedOut?: boolean;
  /** Points/Transfers mode: show points and price (optional) */
  points?: number;
  price?: number;
  priceChange?: number;
}

export function PlayerCard({
  name,
  photoUrl,
  isCaptain,
  isWildCard,
  addedAtEpisode,
  currentTribe,
  possessions,
  isVotedOut,
  points,
  price,
  priceChange,
}: PlayerCardProps) {
  const showPickTeamMode = possessions !== undefined;

  return (
    <div
      className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} flex flex-col rounded-xl overflow-hidden texture-sandy stone-outline bg-stone-800/90 relative isolate`}
    >
      <div className={`${PHOTO_HEIGHT} w-full overflow-hidden bg-stone-800/50 relative z-[1] shrink-0`}>
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent z-[1] pointer-events-none" />
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover object-top ${isVotedOut ? VOTED_OUT_IMAGE_CLASS : ""}`}
        />
      </div>
      {/* Full-width colored tribe banner below photo (thicker in Pick Team mode) */}
      {currentTribe && (
        <div className="relative z-[2]">
          <TribalRibbon tribeId={currentTribe} thick={showPickTeamMode} />
        </div>
      )}
      <div className={`p-2 flex flex-col gap-0.5 items-center text-center relative z-[2] shrink-0 ${CARD_CONTENT_MIN_H}`}>
        <div className="flex items-center justify-center gap-1 flex-wrap">
          <span className="font-bold text-stone-100 text-sm leading-tight">
            {formatDisplayName(name)}
          </span>
          {isVotedOut && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${VOTED_OUT_BADGE_CLASS}`}>{VOTED_OUT_BADGE_TEXT}</span>
          )}
          {isCaptain && (
            <span className="text-orange-400 text-xs shrink-0">★</span>
          )}
        </div>
        {isWildCard && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-600/60 text-stone-100">
            Wild
          </span>
        )}
        {showPickTeamMode ? (
          <>
            {currentTribe && (
              <span className="text-xs text-stone-300/80">{getTribeDisplayName(currentTribe)}</span>
            )}
            <PossessionIcons
              idols={possessions?.idols ?? 0}
              advantages={possessions?.advantages ?? 0}
              clues={possessions?.clues ?? 0}
              size="sm"
            />
          </>
        ) : (
          (points !== undefined || price !== undefined) && (
            <div className="text-xs text-stone-300 space-y-0.5">
              {points !== undefined && <span>{points} pts</span>}
              {price !== undefined && (
                <span>
                  ${price.toLocaleString()}
                  {priceChange !== undefined && priceChange !== 0 && (
                    <span
                      className={`ml-1 ${
                        priceChange > 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      ({priceChange > 0 ? "+" : ""}
                      {priceChange.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
