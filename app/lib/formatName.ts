/** Max chars before shortening (e.g. "Jennifer L.") */
const MAX_NAME_LENGTH = 14;

/**
 * Shorten long names: "Jennifer Lopez" -> "Jennifer L."
 * Keeps first name full, last name becomes first initial + "."
 */
export function formatDisplayName(name: string): string {
  if (!name || name.length <= MAX_NAME_LENGTH) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  const shortened = `${firstName} ${lastInitial}.`;
  return shortened.length <= MAX_NAME_LENGTH ? shortened : name;
}
