"use client";

import { useState, useEffect } from "react";
import { getDisplayPhotoUrl } from "@/lib/photo";
import { formatDisplayName } from "@/lib/formatName";

interface CaptainPickerProps {
  episodeId: number;
  entries: { contestant_id: string; is_wild_card?: boolean }[];
  contestants: { id: string; name: string; photo_url?: string }[];
  onPicked: () => void;
}

export function CaptainPicker({
  episodeId,
  entries,
  contestants,
  onPicked,
}: CaptainPickerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/captain")
      .then((r) => r.json())
      .then((d) => setSelected(d.picks?.[episodeId] ?? null));
  }, [episodeId]);

  const contestantMap = new Map(contestants.map((c) => [c.id, c]));
  const rosterNames = entries.map((e) => {
    const c = contestantMap.get(e.contestant_id);
    return {
      id: e.contestant_id,
      name: c?.name ?? e.contestant_id,
      photo_url: getDisplayPhotoUrl(c?.photo_url, e.contestant_id),
    };
  });

  const handlePick = async (contestantId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/captain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: episodeId, contestant_id: contestantId }),
      });
      if (res.ok) {
        setSelected(contestantId);
        onPicked();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-300/80">
        Captain gets 2× points for Episode {episodeId}. Select one:
      </p>
      <div className="flex flex-wrap gap-3">
        {rosterNames.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handlePick(c.id)}
            disabled={loading}
            className={`w-[140px] min-w-[140px] flex flex-col rounded-xl overflow-hidden transition-colors touch-manipulation texture-sandy
              border-2
              ${selected === c.id
                ? "border-orange-500 bg-orange-600/30 text-stone-100 ring-2 ring-orange-400/50 bg-stone-800/90"
                : "border-stone-600/50 bg-stone-800/90 text-stone-200 hover:border-orange-600/70"
              }`}
          >
            <div className="h-[100px] w-full overflow-hidden bg-stone-800/50 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent z-[1] pointer-events-none" />
              <img src={c.photo_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
            </div>
            <div className="p-2 flex flex-col items-center text-center">
              <span className="font-bold text-sm">{formatDisplayName(c.name)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
