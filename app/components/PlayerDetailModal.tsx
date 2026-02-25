"use client";

import { useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ContestantPointsSummary } from "@/lib/scoring";
import { formatDisplayName } from "@/lib/formatName";
import { TribalRibbon } from "./TribalPattern";
import { getTribeRibbonColor, getTribeDisplayName } from "@/lib/tribes";
import { VOTED_OUT_BADGE_CLASS, VOTED_OUT_BADGE_TEXT, VOTED_OUT_IMAGE_CLASS, TRANSFERRED_BADGE_CLASS } from "@/lib/statusStyles";

export interface PlayerDetailTraits {
  physicality?: number;
  cognition: number;
  strategy: number;
  influence: number;
  resilience: number;
}

export interface PlayerDetailContentProps {
  name: string;
  photoUrl: string;
  tribe?: string | null;
  isWildCard?: boolean;
  addedAtEpisode: number;
  breakdown: ContestantPointsSummary;
  isVotedOut?: boolean;
  isTransferredOut?: boolean;
  traits?: PlayerDetailTraits;
}

/** Shared body for player detail (modal and per-player page). */
export function PlayerDetailContent({
  name,
  photoUrl,
  tribe,
  isWildCard,
  breakdown,
  isVotedOut,
  isTransferredOut,
  traits,
}: PlayerDetailContentProps) {
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null);

  const radarData =
    traits != null
      ? [
          { subject: "Physicality", value: traits.physicality ?? 50, fullMark: 100 },
          { subject: "Cognition", value: traits.cognition, fullMark: 100 },
          { subject: "Strategy", value: traits.strategy, fullMark: 100 },
          { subject: "Influence", value: traits.influence, fullMark: 100 },
          { subject: "Resilience", value: traits.resilience, fullMark: 100 },
        ]
      : null;

  return (
    <>
      <div className="h-44 sm:h-52 w-full overflow-hidden bg-stone-800/50">
        <img
          src={photoUrl}
          alt=""
          loading="eager"
          fetchPriority="high"
          className={`w-full h-full object-cover object-top ${isVotedOut ? VOTED_OUT_IMAGE_CLASS : ""}`}
        />
      </div>
      {tribe && <TribalRibbon tribeId={tribe} title={getTribeDisplayName(tribe)} />}

      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-stone-100">{formatDisplayName(name)}</h2>
          <div className="flex flex-wrap gap-2 mt-1">
            {tribe && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${getTribeRibbonColor(tribe)} text-stone-100`}>
                {getTribeDisplayName(tribe)}
              </span>
            )}
            {isWildCard && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-600/50 text-stone-100">
                Wild
              </span>
            )}
            {isTransferredOut && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${TRANSFERRED_BADGE_CLASS}`}>
                Transferred
              </span>
            )}
            {isVotedOut && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${VOTED_OUT_BADGE_CLASS}`}>
                {VOTED_OUT_BADGE_TEXT}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl texture-sandy bg-stone-800/80 p-2 stone-outline">
          <div className="text-2xl font-bold text-orange-400 text-center">
            {breakdown.total_points} pts total
          </div>
        </div>

        {radarData != null && (
          <div className="rounded-xl texture-sandy bg-stone-800/80 p-3 stone-outline">
            <h3 className="text-sm font-semibold text-stone-200 mb-2">Traits</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(168,162,158,0.4)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "rgb(231,229,224)", fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      const subject = p.name ?? (p.payload?.subject as string);
                      const value = typeof p.value === "number" ? p.value : (p.payload?.value as number);
                      return (
                        <div className="rounded-lg bg-stone-800 border border-stone-600 px-3 py-2 text-sm text-stone-100 shadow-xl">
                          {subject}: <span className="font-semibold text-orange-400">{value}</span>
                        </div>
                      );
                    }}
                  />
                  <Radar
                    name="Traits"
                    dataKey="value"
                    stroke="rgb(234,88,12)"
                    fill="rgba(234,88,12,0.35)"
                    fillOpacity={1}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-stone-200 mb-2">Point breakdown by week</h3>
          <div className="space-y-2">
            {breakdown.episodes
              .filter((e) => e.episode_id > 0)
              .map((ep) => (
                <div
                  key={ep.episode_id}
                  className="rounded-lg texture-sandy bg-stone-800/80 stone-outline overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedEpisode(expandedEpisode === ep.episode_id ? null : ep.episode_id)}
                    className="w-full flex justify-between items-center p-2 text-left hover:bg-stone-700/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-stone-100">
                      Episode {ep.episode_id}
                      {ep.is_captain && <span className="ml-1 text-orange-400">★</span>}
                    </span>
                    <span className="text-sm font-bold text-stone-300">
                      {ep.total} pts
                    </span>
                    <svg
                      className={`w-4 h-4 text-orange-400 transition-transform ${
                        expandedEpisode === ep.episode_id ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedEpisode === ep.episode_id && (
                    <ul className="p-2 pt-0 space-y-0.5 text-xs border-t border-stone-600/50">
                      {ep.sources.map((s, i) => (
                        <li
                          key={i}
                          className="flex justify-between text-stone-200/90"
                        >
                          <span>{s.label}</span>
                          <span
                            className={
                              s.points >= 0 ? "text-emerald-400" : "text-red-400"
                            }
                          >
                            {s.points >= 0 ? "+" : ""}
                            {s.points}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}

interface PlayerDetailModalProps extends PlayerDetailContentProps {
  onClose: () => void;
}

export function PlayerDetailModal({
  name,
  photoUrl,
  tribe,
  isWildCard,
  addedAtEpisode,
  breakdown,
  isVotedOut,
  isTransferredOut,
  traits,
  onClose,
}: PlayerDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-28 pb-4 px-4 bg-black/70 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl shadow-2xl stone-outline texture-sandy bg-stone-900 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <PlayerDetailContent
            name={name}
            photoUrl={photoUrl}
            tribe={tribe}
            isWildCard={isWildCard}
            addedAtEpisode={addedAtEpisode}
            breakdown={breakdown}
            isVotedOut={isVotedOut}
            isTransferredOut={isTransferredOut}
            traits={traits}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-stone-200 hover:bg-black/80 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
