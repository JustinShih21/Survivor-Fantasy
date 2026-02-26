"use client";

import { useState, useEffect, useCallback } from "react";
import { getDisplayPhotoUrl } from "@/lib/photo";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CARD_MIN_WIDTH, CARD_WIDTH } from "@/lib/cardDimensions";
import { PlayerCard } from "./PlayerCard";
import { CaptainConfirmationModal } from "./CaptainConfirmationModal";

const CAPTAIN_SLOT_ID = "captain-slot";

interface RosterEntry {
  contestant_id: string;
  is_wild_card?: boolean;
  added_at_episode: number;
}

interface Possessions {
  idols: number;
  advantages: number;
  clues: number;
}

interface TeamRosterDisplayProps {
  entries: RosterEntry[];
  contestants: { id: string; name: string; pre_merge_price?: number; photo_url?: string }[];
  currentEpisode: number;
  captainId: string | null;
  onPicked: () => void;
  possessions: Record<string, Possessions>;
  contestantTribes: Record<string, string>;
  eliminated: string[];
}

function getPhotoUrl(
  contestantId: string,
  contestants: { id: string; photo_url?: string }[]
) {
  const c = contestants.find((x) => x.id === contestantId);
  return getDisplayPhotoUrl(c?.photo_url, contestantId);
}

function DraggableCaptainSlot({
  entry,
  contestants,
  possessions,
  contestantTribes,
  eliminated,
}: {
  entry: RosterEntry | null;
  contestants: { id: string; name: string; pre_merge_price?: number; photo_url?: string }[];
  possessions: Record<string, Possessions>;
  contestantTribes: Record<string, string>;
  eliminated: string[];
}) {
  const contestantMap = new Map(contestants.map((c) => [c.id, c]));
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({ id: CAPTAIN_SLOT_ID });
  const { setNodeRef: setDroppableRef, isOver: droppableIsOver } =
    useDroppable({ id: CAPTAIN_SLOT_ID });

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDraggableRef(el);
      setDroppableRef(el);
    },
    [setDraggableRef, setDroppableRef]
  );

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const overlay = droppableIsOver;

  const isVotedOut = entry ? eliminated.includes(entry.contestant_id) : false;

  return (
    <div
      ref={setRef}
      style={style}
      className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} rounded-xl min-h-[200px] md:min-h-[188px] transition-colors overflow-hidden ${
        overlay
          ? "border-2 border-orange-500 bg-orange-900/30"
          : entry
            ? "bg-transparent"
            : "stone-outline bg-stone-800/90 texture-sandy border-2 border-dashed border-stone-600 md:border-solid"
      } ${isDragging ? "opacity-60" : ""}`}
    >
      {entry ? (
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing touch-manipulation w-full min-h-[200px] md:min-h-[188px] flex flex-col"
        >
          <PlayerCard
            contestantId={entry.contestant_id}
            name={contestantMap.get(entry.contestant_id)?.name ?? entry.contestant_id}
            photoUrl={getPhotoUrl(entry.contestant_id, contestants)}
            isCaptain
            isWildCard={entry.is_wild_card}
            addedAtEpisode={entry.added_at_episode}
            currentTribe={contestantTribes[entry.contestant_id] ?? null}
            possessions={possessions[entry.contestant_id] ?? { idols: 0, advantages: 0, clues: 0 }}
            isVotedOut={isVotedOut}
          />
        </div>
      ) : (
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing flex items-center justify-center min-h-[200px] md:min-h-[188px] p-4 touch-manipulation"
        >
          <span className="text-stone-300/70 text-sm text-center">
            Drag a player here to select captain
          </span>
        </div>
      )}
    </div>
  );
}

function DraggableRosterCard({
  entry,
  contestants,
  possessions,
  contestantTribes,
  eliminated,
  onTapSetCaptain,
}: {
  entry: RosterEntry;
  contestants: { id: string; name: string; pre_merge_price?: number; photo_url?: string }[];
  possessions: Record<string, Possessions>;
  contestantTribes: Record<string, string>;
  eliminated: string[];
  onTapSetCaptain?: (contestantId: string) => void;
}) {
  const id = `roster-${entry.contestant_id}`;
  const contestantMap = new Map(contestants.map((c) => [c.id, c]));
  const c = contestantMap.get(entry.contestant_id);
  const isVotedOut = eliminated.includes(entry.contestant_id);

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({ id });
  const { setNodeRef: setDroppableRef, isOver: droppableIsOver } =
    useDroppable({ id });

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDraggableRef(el);
      setDroppableRef(el);
    },
    [setDraggableRef, setDroppableRef]
  );

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const overlay = droppableIsOver;

  return (
    <div
      ref={setRef}
      style={style}
      className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} shrink-0 rounded-xl transition-colors overflow-hidden ${
        overlay
          ? "border-2 border-orange-500 bg-orange-900/30"
          : "bg-transparent"
      } ${isDragging ? "opacity-60" : ""}`}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing touch-manipulation w-full"
      >
        <PlayerCard
          contestantId={entry.contestant_id}
          name={c?.name ?? entry.contestant_id}
          photoUrl={getPhotoUrl(entry.contestant_id, contestants)}
          isWildCard={entry.is_wild_card}
          addedAtEpisode={entry.added_at_episode}
          currentTribe={contestantTribes[entry.contestant_id] ?? null}
          possessions={possessions[entry.contestant_id] ?? { idols: 0, advantages: 0, clues: 0 }}
          isVotedOut={isVotedOut}
        />
      </div>
      {onTapSetCaptain && !isVotedOut && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTapSetCaptain(entry.contestant_id);
          }}
          className="md:hidden w-full min-h-[44px] py-2 text-xs font-medium text-orange-400 hover:text-orange-300 hover:bg-stone-800/80 border-t border-stone-700/50 touch-manipulation"
        >
          Set as captain
        </button>
      )}
    </div>
  );
}

export function TeamRosterDisplay({
  entries,
  contestants,
  currentEpisode,
  captainId,
  onPicked,
  possessions,
  contestantTribes,
  eliminated,
}: TeamRosterDisplayProps) {
  const [pendingCaptain, setPendingCaptain] = useState<{
    name: string;
    id: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const captainEntry = captainId
    ? entries.find((e) => e.contestant_id === captainId) ?? null
    : null;
  const rosterEntries = captainId
    ? entries.filter((e) => e.contestant_id !== captainId)
    : entries;

  const contestantMap = new Map(contestants.map((c) => [c.id, c]));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      let newCaptainId: string | null = null;

      if (activeId === CAPTAIN_SLOT_ID && overId.startsWith("roster-")) {
        newCaptainId = overId.replace("roster-", "");
      } else if (activeId.startsWith("roster-") && overId === CAPTAIN_SLOT_ID) {
        newCaptainId = activeId.replace("roster-", "");
      }

      if (newCaptainId && newCaptainId !== captainId) {
        const name = contestantMap.get(newCaptainId)?.name ?? newCaptainId;
        setPendingCaptain({ id: newCaptainId, name });
      }
    },
    [captainId, contestantMap]
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingCaptain) return;
    setLoading(true);
    try {
      const res = await fetch("/api/captain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: currentEpisode,
          contestant_id: pendingCaptain.id,
        }),
      });
      if (res.ok) {
        setPendingCaptain(null);
        onPicked();
      }
    } finally {
      setLoading(false);
    }
  }, [pendingCaptain, currentEpisode, onPicked]);

  const handleCancel = useCallback(() => setPendingCaptain(null), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } })
  );

  const handleTapSetCaptain = useCallback(
    (contestantId: string) => {
      if (contestantId === captainId) return;
      const name = contestantMap.get(contestantId)?.name ?? contestantId;
      setPendingCaptain({ id: contestantId, name });
    },
    [captainId, contestantMap]
  );

  return (
    <>
      <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <div className="space-y-6">
          <div className="flex flex-col items-center w-full">
            <h3 className="sand-inscription mb-2 flex items-center gap-2 justify-center">
              <span className="text-orange-400/80">★</span> Captain
            </h3>
            <div className="w-full flex justify-center">
              <div className="w-full max-w-[180px]">
                <DraggableCaptainSlot
                  entry={captainEntry}
                  contestants={contestants}
                  possessions={possessions}
                  contestantTribes={contestantTribes}
                  eliminated={eliminated}
                />
              </div>
            </div>
            <p className="md:sr-only text-xs text-stone-400 mt-2 text-center">
              Drop a player here or tap &quot;Set as captain&quot; below a roster player
            </p>
          </div>

          <div className="flex flex-col items-center">
            <h3 className="sand-inscription mb-2 text-center w-full">Roster</h3>
            <div className="flex flex-wrap gap-3 overflow-x-auto pb-2 justify-center">
              {rosterEntries.map((e) => (
                <DraggableRosterCard
                  key={e.contestant_id}
                  entry={e}
                  contestants={contestants}
                  possessions={possessions}
                  contestantTribes={contestantTribes}
                  eliminated={eliminated}
                  onTapSetCaptain={handleTapSetCaptain}
                />
              ))}
            </div>
          </div>
        </div>
      </DndContext>

      <CaptainConfirmationModal
        contestantName={pendingCaptain?.name ?? ""}
        episodeId={currentEpisode}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isOpen={!!pendingCaptain}
      />
    </>
  );
}
