/**
 * Tribal caveman-style pattern for buff ribbons and backgrounds.
 * Primitive symbols: zigzags, dots, hand outlines, stick figures, wavy lines.
 */

import { getTribeDisplayName, getTribeRibbonColor } from "@/lib/tribes";

/** Data URI for a small repeating tribal pattern - use as background-image on ribbons */
export const TRIBAL_RIBBON_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='8' viewBox='0 0 32 8'%3E%3Cg fill='none' stroke='rgba(0,0,0,0.25)' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M0 4 L4 2 L8 4 L12 2 L16 4 L20 2 L24 4 L28 2 L32 4'/%3E%3Cpath d='M2 6 L6 4 L10 6 L14 4 L18 6 L22 4 L26 6 L30 4'/%3E%3Ccircle cx='8' cy='2' r='1'/%3E%3Ccircle cx='24' cy='2' r='1'/%3E%3Cpath d='M4 0 L5 2 L4 4 L3 2 Z'/%3E%3Cpath d='M20 0 L21 2 L20 4 L19 2 Z'/%3E%3C/g%3E%3C/svg%3E")`;

interface TribalRibbonProps {
  tribeId: string;
  className?: string;
  title?: string;
  /** When true, render a thicker banner (e.g. for Pick Team cards) */
  thick?: boolean;
}

/** Renders a tribe buff ribbon with tribal caveman pattern overlay */
export function TribalRibbon({ tribeId, className = "", title, thick }: TribalRibbonProps) {
  const displayName = getTribeDisplayName(tribeId);
  const ribbonColor = getTribeRibbonColor(tribeId);

  return (
    <div
      className={`w-full relative overflow-hidden ${thick ? "h-4" : "h-2"} ${ribbonColor} ${className}`}
      title={title ?? displayName}
      style={{
        backgroundImage: TRIBAL_RIBBON_PATTERN,
        backgroundSize: "32px 8px",
      }}
    />
  );
}
