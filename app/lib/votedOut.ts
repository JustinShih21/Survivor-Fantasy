type OutcomeLike = Record<string, unknown> | null | undefined;

function normalizeIds(value: unknown): string[] {
  if (typeof value === "string") {
    const id = value.trim();
    return id ? [id] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function extractVotedOutIds(outcome: OutcomeLike): string[] {
  if (!outcome || typeof outcome !== "object") return [];

  const fromIds = normalizeIds(outcome.voted_out_ids);
  const legacy = normalizeIds(outcome.voted_out);

  if (fromIds.length === 0) return legacy;
  if (legacy.length === 0) return fromIds;

  const merged = [...fromIds];
  for (const id of legacy) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

export function extractPrimaryVotedOutId(outcome: OutcomeLike): string | null {
  const ids = extractVotedOutIds(outcome);
  return ids[0] ?? null;
}
