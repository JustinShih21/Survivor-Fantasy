"use client";

import { useEffect, useRef } from "react";

interface CaptainConfirmationModalProps {
  contestantName: string;
  episodeId: number;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function CaptainConfirmationModal({
  contestantName,
  episodeId,
  onConfirm,
  onCancel,
  isOpen,
}: CaptainConfirmationModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleEscape);
    confirmRef.current?.focus();

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="captain-modal-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl texture-sandy bg-stone-900 stone-outline shadow-2xl p-6 md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="captain-modal-title" className="text-xl font-bold text-stone-100 mb-2">
          Confirm Captain
        </h2>
        <p className="text-stone-300/90 mb-6 text-base">
          Make <strong className="text-stone-100">{contestantName}</strong> your
          captain for Episode {episodeId}? Their points will be doubled for this
          episode.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl stone-outline bg-stone-800/50 text-stone-200 hover:border-orange-600/50 transition-colors font-medium touch-manipulation"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] min-w-[44px] px-6 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold transition-colors touch-manipulation"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
