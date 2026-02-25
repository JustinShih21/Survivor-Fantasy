/**
 * Survivor 50 tribe names and buff ribbon colors.
 * Tribe A = Cila (orange), Tribe B = Kalo (pink), Tribe C = Vatu (blue)
 */
export const TRIBE_CONFIG: Record<
  string,
  { name: string; color: string; ribbonColor: string }
> = {
  "Tribe A": {
    name: "Cila",
    color: "orange",
    ribbonColor: "bg-orange-600/90",
  },
  "Tribe B": {
    name: "Kalo",
    color: "pink",
    ribbonColor: "bg-pink-600/90",
  },
  "Tribe C": {
    name: "Vatu",
    color: "blue",
    ribbonColor: "bg-blue-600/90",
  },
};

export const TRIBE_IDS = ["Tribe A", "Tribe B", "Tribe C"] as const;
export type TribeId = (typeof TRIBE_IDS)[number];

export function getTribeDisplayName(tribeId: string): string {
  return TRIBE_CONFIG[tribeId]?.name ?? tribeId;
}

/** Returns Tailwind class for buff ribbon (e.g. bg-orange-600/90). Use between photo and name on cards. */
export function getTribeRibbonColor(tribeId: string): string {
  return TRIBE_CONFIG[tribeId]?.ribbonColor ?? "bg-stone-600/80";
}
