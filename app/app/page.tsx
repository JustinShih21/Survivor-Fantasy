"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TribeBuilder } from "@/components/TribeBuilder";
import { FIRST_EPISODE_AIRTIME } from "@/lib/seasonConfig";
import { useAppData } from "@/components/AppDataProvider";
import type { ContestantPointsSummary } from "@/lib/scoring";

interface HomeContentItem {
  id: string;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  link_url?: string | null;
  image_url?: string | null;
}

function HomeContentCards() {
  const [items, setItems] = useState<HomeContentItem[]>([]);
  useEffect(() => {
    fetch("/api/home-content")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-stone-200/90">Survivor Fantasy</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const href = item.link_url || (item.slug ? `/article/${item.slug}` : undefined);
          const content = (
            <div className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline hover:border-orange-600/50 transition-colors">
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
              )}
              <div className="font-semibold text-stone-100">{item.title}</div>
              {item.excerpt && (
                <p className="text-sm text-stone-400 mt-1 line-clamp-2">{item.excerpt}</p>
              )}
            </div>
          );
          return href ? (
            <Link key={item.id} href={href} aria-label={item.title}>
              {content}
            </Link>
          ) : (
            <div key={item.id}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeLeft(until: Date): { days: number; hours: number; minutes: number; seconds: number; done: boolean } {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { days, hours, minutes, seconds, done: false };
}

function CountdownToFirstEpisode() {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(FIRST_EPISODE_AIRTIME));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getTimeLeft(FIRST_EPISODE_AIRTIME);
      setTimeLeft(next);
      if (next.done) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline text-center">
      <h3 className="text-sm font-semibold text-stone-200/90 mb-2">
        First episode
      </h3>
      {timeLeft.done ? (
        <p className="text-lg font-bold text-orange-400">00:00:00</p>
      ) : (
        <p className="text-lg font-mono font-bold text-orange-400">
          {timeLeft.days}d {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s
        </p>
      )}
      <p className="text-xs text-stone-300/70 mt-1">
        {timeLeft.done ? "Season starts!" : "Until first episode"}
      </p>
    </div>
  );
}

export default function Home() {
  const { data, loading } = useAppData();
  const scores = data?.scores ?? null;
  const currentEpisode = data?.season?.current_episode ?? 1;
  const [viewingEpisode, setViewingEpisode] = useState(currentEpisode);

  useEffect(() => {
    queueMicrotask(() => {
      setViewingEpisode((prev) => (currentEpisode >= 1 ? currentEpisode : prev));
    });
  }, [currentEpisode]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-300/80">Loading...</span>
      </div>
    );
  }

  const hasTribe = (scores?.entries?.length ?? 0) > 0;

  if (!hasTribe) {
    return (
      <div className="space-y-6">
        <CountdownToFirstEpisode />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-100">Build Your Tribe</h1>
          <p className="text-stone-300/80 text-sm mt-1">
            Outwit · Outplay · Outlast
          </p>
        </div>
        <TribeBuilder />
        <HomeContentCards />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CountdownToFirstEpisode />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-stone-100">Your Tribe</h1>
        <p className="text-stone-300/70 text-sm mt-1">
          {currentEpisode === 0 || (scores?.episode_count ?? 0) === 0
            ? "Season hasn't started"
            : `Episode ${currentEpisode} of ${scores?.episode_count ?? 6}`}
        </p>
      </div>

      <div className="p-6 rounded-2xl texture-sandy bg-stone-800/90 stone-outline shadow-xl">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setViewingEpisode((e) => Math.max(1, e - 1))}
            disabled={viewingEpisode <= 1}
            className="p-2 rounded-lg bg-stone-700/80 text-stone-200 hover:bg-stone-600/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link href="/points" className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              Ep {viewingEpisode}: {((scores?.contestant_breakdowns ?? []) as ContestantPointsSummary[]).reduce(
                (sum, b) => {
                  const ep = b.episodes.find((e) => e.episode_id === viewingEpisode);
                  return sum + (ep?.total ?? 0);
                },
                0
              )} pts
            </div>
            <div className="text-sm text-stone-300/80 mt-0.5">
              Total: {scores?.total ?? 0} pts
            </div>
            <div className="text-orange-400/80 text-xs mt-1">View details →</div>
          </Link>
          <button
            type="button"
            onClick={() => setViewingEpisode((e) => Math.min(scores?.episode_count ?? 6, e + 1))}
            disabled={viewingEpisode >= (scores?.episode_count ?? 6)}
            className="p-2 rounded-lg bg-stone-700/80 text-stone-200 hover:bg-stone-600/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/pick-team"
          className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline hover:border-orange-600/50 transition-colors text-center"
        >
          <div className="font-semibold text-stone-100">Pick Team</div>
          <div className="text-xs text-stone-300/70 mt-1">
            View roster & captain
          </div>
        </Link>
        <Link
          href="/transfers"
          className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline hover:border-orange-600/50 transition-colors text-center"
        >
          <div className="font-semibold text-stone-100">Transfers</div>
          <div className="text-xs text-stone-300/70 mt-1">
            Sell & add contestants
          </div>
        </Link>
        <Link
          href="/leagues"
          className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline hover:border-orange-600/50 transition-colors text-center"
        >
          <div className="font-semibold text-stone-100">Leagues</div>
          <div className="text-xs text-stone-300/70 mt-1">
            View standings
          </div>
        </Link>
      </div>

      <div className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h3 className="text-sm font-semibold text-stone-200/90 mb-2">
          Your Points
        </h3>
        <p className="text-sm text-stone-300/70">
          Total: {scores?.total ?? 0} pts
        </p>
        <Link
          href="/leagues"
          className="text-sm text-orange-400 hover:underline mt-1 inline-block"
        >
          View leagues & leaderboard →
        </Link>
      </div>

      <HomeContentCards />
    </div>
  );
}
