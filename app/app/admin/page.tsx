"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { POINT_BREAKDOWN_CATEGORIES, type PointBreakdownCategory } from "@/lib/scoring";

const MAX_EPISODES = 18;

type CategoryOverrideRow = { contestant_id: string; episode_id: number; category: string; points: number };

type PointsBreakdownResponse = {
  episode_id: number;
  contestants: { id: string; name: string }[];
  breakdowns: {
    contestant_id: string;
    total: number;
    sources: { label: string; points: number; isOverride: boolean }[];
  }[];
};

type PriceAuditContestant = {
  contestant_id: string;
  prev_price: number;
  new_price: number;
  price_change: number;
  weighted_score: number;
  field_avg: number;
  perf_ratio: number;
  category_contributions: Record<string, number>;
};

type PriceAuditResponse = {
  episode: number;
  run_at: string | null;
  adjustment_rate: number | null;
  contestants: PriceAuditContestant[];
};

type MarketMappingRow = {
  id: string;
  provider: string;
  market_ticker: string;
  episode_id: number;
  contestant_id: string;
  category: string;
  side: "yes" | "no";
  transform: "direct" | "inverse";
  confidence: number;
  is_active: boolean;
  notes: string | null;
};

type ForecastRow = {
  contestant_id: string;
  contestant_name: string;
  category: string;
  probability: number | null;
  expected_value: number | null;
  model_version: string;
  created_at: string;
};

function PointCategoryOverridesSection() {
  const [contestants, setContestants] = useState<{ id: string; name: string }[]>([]);
  const [episodeCount, setEpisodeCount] = useState(6);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [overrides, setOverrides] = useState<CategoryOverrideRow[]>([]);
  const [breakdownsData, setBreakdownsData] = useState<PointsBreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedContestantId, setSelectedContestantId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PointBreakdownCategory>(POINT_BREAKDOWN_CATEGORIES[0]);
  const [pointsInput, setPointsInput] = useState("");
  const [clearingAll, setClearingAll] = useState(false);

  const fetchBreakdown = () => {
    setBreakdownLoading(true);
    fetch(`/api/admin/points-breakdown?episode_id=${selectedEpisode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PointsBreakdownResponse | null) => {
        if (data != null) setBreakdownsData(data);
      })
      .catch(() => {})
      .finally(() => setBreakdownLoading(false));
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/contestants").then((r) => r.json()),
      fetch("/api/season").then((r) => r.json()),
    ])
      .then(([cont, season]) => {
        setContestants(Array.isArray(cont) ? cont : []);
        const ep = (season as { current_episode?: number }).current_episode ?? 6;
        const count = Math.max(MAX_EPISODES, ep);
        setEpisodeCount(count);
        setCurrentEpisode(ep);
        setSelectedEpisode((s) => (s > count ? count : s));
        if (!selectedContestantId && Array.isArray(cont) && cont.length > 0) {
          setSelectedContestantId((cont[0] as { id: string }).id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`/api/admin/point-category-overrides?episode_id=${selectedEpisode}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((arr: CategoryOverrideRow[]) => setOverrides(Array.isArray(arr) ? arr : []))
      .catch(() => setOverrides([]));
  }, [selectedEpisode]);

  useEffect(() => {
    fetchBreakdown();
  }, [selectedEpisode]);

  const addOverride = async () => {
    const points = pointsInput.trim() === "" ? null : parseInt(pointsInput, 10);
    if (!selectedContestantId || (points != null && (Number.isNaN(points) || !Number.isInteger(points)))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/point-category-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestant_id: selectedContestantId,
          episode_id: selectedEpisode,
          category: selectedCategory,
          points: points ?? 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : res.statusText || "Failed";
        throw new Error(msg);
      }
      const list = await fetch(`/api/admin/point-category-overrides?episode_id=${selectedEpisode}`).then((r) => r.json());
      setOverrides(Array.isArray(list) ? list : []);
      fetchBreakdown();
      if (points != null) setPointsInput("");
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async (contestantId: string, category: string) => {
    const res = await fetch(
      `/api/admin/point-category-overrides?contestant_id=${encodeURIComponent(contestantId)}&episode_id=${selectedEpisode}&category=${encodeURIComponent(category)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setOverrides((prev) => prev.filter((r) => !(r.contestant_id === contestantId && r.category === category)));
      fetchBreakdown();
    }
  };

  const clearAllOverrides = async () => {
    if (!confirm("Delete all point overrides for every contestant and episode? Everyone’s points will be zero.")) return;
    setClearingAll(true);
    try {
      const res = await fetch("/api/admin/point-category-overrides?all=true", { method: "DELETE" });
      if (res.ok) {
        setOverrides([]);
        setBreakdownsData(null);
        fetchBreakdown();
        fetch(`/api/admin/point-category-overrides?episode_id=${selectedEpisode}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((arr: CategoryOverrideRow[]) => setOverrides(Array.isArray(arr) ? arr : []));
      }
    } finally {
      setClearingAll(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  const episodes = Array.from({ length: episodeCount }, (_, i) => i + 1);
  const contestantName = (id: string) => contestants.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-stone-300 text-sm">Episode</label>
        <select
          value={selectedEpisode}
          onChange={(e) => setSelectedEpisode(Number(e.target.value))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        >
          {episodes.map((ep) => (
            <option key={ep} value={ep}>Episode {ep}</option>
          ))}
        </select>
        <label className="text-stone-300 text-sm">Contestant</label>
        <select
          value={selectedContestantId}
          onChange={(e) => setSelectedContestantId(e.target.value)}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm min-w-[140px]"
        >
          {contestants.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="text-stone-300 text-sm">Category</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as PointBreakdownCategory)}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm min-w-[180px]"
        >
          {POINT_BREAKDOWN_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label className="text-stone-300 text-sm">Points</label>
        <input
          type="number"
          value={pointsInput}
          onChange={(e) => setPointsInput(e.target.value)}
          placeholder="0"
          className="w-20 px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        />
        <button
          type="button"
          onClick={addOverride}
          disabled={saving}
          className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Add / Save"}
        </button>
        <button
          type="button"
          onClick={clearAllOverrides}
          disabled={clearingAll}
          className="ml-auto px-3 py-1.5 rounded bg-red-900/80 text-red-200 text-sm font-medium hover:bg-red-800 disabled:opacity-50"
        >
          {clearingAll ? "Clearing..." : "Clear all overrides"}
        </button>
      </div>
      <div className="border-t border-stone-600 pt-4 mt-4">
        <h3 className="text-base font-semibold text-stone-200 mb-1">
          All contestants — point opportunities for {selectedEpisode === currentEpisode ? "this week" : `Episode ${selectedEpisode}`}
        </h3>
        <p className="text-stone-400 text-sm mb-3">
          Every point opportunity each contestant scored this episode. Delete only appears on entries you added (overrides).
        </p>
        {breakdownLoading ? (
          <p className="text-stone-500 text-sm py-2">Loading breakdowns...</p>
        ) : !breakdownsData ? (
          <p className="text-stone-500 text-sm py-2">No breakdown data. Select an episode that has outcomes.</p>
        ) : (
          <div className="space-y-4 overflow-y-auto max-h-[520px]">
            {breakdownsData.contestants.map((c) => {
              const bd = breakdownsData.breakdowns.find((b) => b.contestant_id === c.id);
              const sources = bd?.sources ?? [];
              const total = bd?.total ?? 0;
              return (
                <div key={c.id} className="rounded-lg bg-stone-800/60 p-3 border border-stone-600/50">
                  <p className="text-stone-200 font-medium mb-1">
                    {c.name}
                    <span className="ml-2 text-stone-400 font-normal text-sm">{total} pts</span>
                  </p>
                  {sources.length === 0 ? (
                    <p className="text-stone-500 text-sm">No point entries for this episode.</p>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-stone-400 border-b border-stone-600">
                          <th className="py-1.5 pr-2">Category</th>
                          <th className="py-1.5 pr-2">Points</th>
                          <th className="py-1.5 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sources.map((s, i) => (
                          <tr key={`${c.id}-${s.label}-${i}`} className="border-b border-stone-700/50 last:border-0">
                            <td className="py-1.5 pr-2 text-stone-300">{s.label}</td>
                            <td className="py-1.5 pr-2 text-stone-300">{s.points}</td>
                            <td className="py-1.5">
                              {s.isOverride ? (
                                <button
                                  type="button"
                                  onClick={() => deleteOverride(c.id, s.label)}
                                  className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-200 hover:bg-red-800/50"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PricingAndTraitsSection() {
  const [contestants, setContestants] = useState<{
    id: string;
    name: string;
    starting_tribe: string;
    pre_merge_price: number;
    physicality?: number;
    cognition?: number;
    strategy?: number;
    influence?: number;
    resilience?: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { pre_merge_price?: number; physicality?: number; cognition?: number; strategy?: number; influence?: number; resilience?: number }>>({});

  useEffect(() => {
    fetch("/api/contestants")
      .then((r) => r.json())
      .then((data) => {
        setContestants(Array.isArray(data) ? data : []);
        const next: Record<string, { pre_merge_price?: number; physicality?: number; cognition?: number; strategy?: number; influence?: number; resilience?: number }> = {};
        for (const c of Array.isArray(data) ? data : []) {
          next[c.id] = {
            pre_merge_price: c.pre_merge_price,
            physicality: c.physicality ?? 50,
            cognition: c.cognition ?? 50,
            strategy: c.strategy ?? 50,
            influence: c.influence ?? 50,
            resilience: c.resilience ?? 50,
          };
        }
        setEdits(next);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveContestant = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/contestants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setContestants((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      setEdits((prev) => ({ ...prev, [id]: { ...e, ...updated } }));
    } finally {
      setSavingId(null);
    }
  };

  const setEdit = (id: string, field: string, value: number) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  if (loading) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-stone-400 border-b border-stone-600">
              <th className="py-2 pr-2">Contestant</th>
              <th className="py-2 pr-2">Price</th>
              <th className="py-2 pr-2">Phy</th>
              <th className="py-2 pr-2">Cog</th>
              <th className="py-2 pr-2">Str</th>
              <th className="py-2 pr-2">Inf</th>
              <th className="py-2 pr-2">Res</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {contestants.map((c) => {
              const e = edits[c.id] ?? {};
              return (
                <tr key={c.id} className="border-b border-stone-700/50">
                  <td className="py-1.5 pr-2 text-stone-200">{c.name}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={50000}
                      max={300000}
                      step={5000}
                      value={e.pre_merge_price ?? c.pre_merge_price ?? ""}
                      onChange={(ev) => setEdit(c.id, "pre_merge_price", Number(ev.target.value) || 0)}
                      className="w-24 px-2 py-1 rounded bg-stone-700 text-stone-100 border border-stone-600"
                    />
                  </td>
                  {(["physicality", "cognition", "strategy", "influence", "resilience"] as const).map((key) => (
                    <td key={key} className="py-1.5 pr-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={e[key] ?? c[key] ?? 50}
                        onChange={(ev) => setEdit(c.id, key, Number(ev.target.value) || 50)}
                        className="w-14 px-1 py-1 rounded bg-stone-700 text-stone-100 border border-stone-600"
                      />
                    </td>
                  ))}
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => saveContestant(c.id)}
                      disabled={savingId === c.id}
                      className="text-xs px-2 py-1 rounded bg-stone-600 text-stone-200 hover:bg-stone-500 disabled:opacity-50"
                    >
                      {savingId === c.id ? "Save..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">Phy = Physicality, Cog = Cognition, Str = Strategy, Inf = Influence, Res = Resilience (1–100). Price: 50,000–300,000.</p>
    </div>
  );
}

type PossessionRow = { contestant_id: string; name: string; idols: number; advantages: number; clues: number };

function PossessionsSection() {
  const [rows, setRows] = useState<PossessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/possessions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const setValue = (contestantId: string, field: "idols" | "advantages" | "clues", delta: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.contestant_id === contestantId
          ? { ...r, [field]: Math.max(0, (r[field] ?? 0) + delta) }
          : r
      )
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/possessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: rows.map((r) => ({
            contestant_id: r.contestant_id,
            idols: r.idols,
            advantages: r.advantages,
            clues: r.clues,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      load();
    } catch {
      // leave rows as-is
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-stone-400 border-b border-stone-600 sticky top-0 bg-stone-800/95 z-10">
              <th className="py-2 pr-2">Contestant</th>
              <th className="py-2 pr-2 text-center">Idols</th>
              <th className="py-2 pr-2 text-center">Advantages</th>
              <th className="py-2 pr-2 text-center">Clues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contestant_id} className="border-b border-stone-700/50">
                <td className="py-1.5 pr-2 text-stone-200">{r.name}</td>
                {(["idols", "advantages", "clues"] as const).map((field) => (
                  <td key={field} className="py-1.5 pr-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setValue(r.contestant_id, field, -1)}
                        disabled={(r[field] ?? 0) <= 0}
                        className="w-7 h-7 rounded bg-stone-600 text-stone-200 hover:bg-stone-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums text-stone-200">{(r[field] ?? 0)}</span>
                      <button
                        type="button"
                        onClick={() => setValue(r.contestant_id, field, 1)}
                        className="w-7 h-7 rounded bg-stone-600 text-stone-200 hover:bg-stone-500 text-sm font-medium"
                      >
                        +
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save all"}
      </button>
      <p className="text-xs text-stone-500">These counts appear on the Pick Team character cards. Save updates all contestants at once.</p>
    </div>
  );
}

interface HomeContentRow {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body: string | null;
  link_url: string | null;
  image_url: string | null;
  sort_order: number;
  published: boolean;
  created_at?: string;
}

function HomeContentSection() {
  const [items, setItems] = useState<HomeContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    link_url: "",
    image_url: "",
    sort_order: 0,
    published: true,
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/home-content")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditingId(null);
    setForm({
      title: "",
      slug: "",
      excerpt: "",
      body: "",
      link_url: "",
      image_url: "",
      sort_order: items.length,
      published: true,
    });
  };

  const startEdit = (row: HomeContentRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      slug: row.slug ?? "",
      excerpt: row.excerpt ?? "",
      body: row.body ?? "",
      link_url: row.link_url ?? "",
      image_url: row.image_url ?? "",
      sort_order: row.sort_order ?? 0,
      published: row.published ?? true,
    });
  };

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        slug: form.slug.trim() || null,
        excerpt: form.excerpt.trim() || null,
        body: form.body.trim() || null,
        link_url: form.link_url.trim() || null,
        image_url: form.image_url.trim() || null,
        sort_order: form.sort_order,
        published: form.published,
      };
      if (editingId) {
        const res = await fetch(`/api/admin/home-content/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed");
      } else {
        const res = await fetch("/api/admin/home-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed");
      }
      load();
      startNew();
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/admin/home-content/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  if (loading) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startNew}
          className="text-sm px-3 py-1.5 rounded bg-orange-600 text-white hover:bg-orange-500"
        >
          {editingId ? "Cancel" : "Add new"}
        </button>
      </div>

      <div className="grid gap-2 text-sm">
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 w-full"
        />
        <input
          type="text"
          placeholder="Slug (for /article/slug)"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 w-full"
        />
        <input
          type="text"
          placeholder="Excerpt"
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 w-full"
        />
        <textarea
          placeholder="Body"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          rows={3}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 w-full"
        />
        <input
          type="text"
          placeholder="Link URL (optional, overrides slug)"
          value={form.link_url}
          onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 w-full"
        />
        <input
          type="text"
          placeholder="Image URL"
          value={form.image_url}
          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 w-full"
        />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-stone-300">
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
              className="w-16 px-2 py-1 rounded bg-stone-700 text-stone-100 border border-stone-600"
            />
            Sort order
          </label>
          <label className="flex items-center gap-2 text-stone-300">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              className="rounded"
            />
            Published
          </label>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !form.title.trim()}
          className="px-3 py-1.5 rounded bg-stone-600 text-stone-200 hover:bg-stone-500 disabled:opacity-50 w-fit"
        >
          {saving ? "Saving..." : editingId ? "Update" : "Create"}
        </button>
      </div>

      <div className="border-t border-stone-600 pt-3 mt-4">
        <p className="text-stone-400 text-sm mb-2">Existing items</p>
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-200 font-medium">{row.title}</span>
              {row.slug && <span className="text-stone-500">/{row.slug}</span>}
              {!row.published && <span className="text-orange-400 text-xs">Draft</span>}
              <button
                type="button"
                onClick={() => startEdit(row)}
                className="text-xs px-2 py-0.5 rounded bg-stone-600 text-stone-300 hover:bg-stone-500"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteItem(row.id)}
                className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-200 hover:bg-red-800/50"
              >
                Delete
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="text-stone-500">No items yet.</li>}
        </ul>
      </div>
    </div>
  );
}

type EpisodeOutcomeRow = {
  episode_id: number;
  voted_out_ids?: string[];
  voted_out?: string | null;
};

function EpisodeOutcomesSection() {
  const [outcomes, setOutcomes] = useState<EpisodeOutcomeRow[]>([]);
  const [contestants, setContestants] = useState<{ id: string; name: string }[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingEpisodeId, setSavingEpisodeId] = useState<number | null>(null);

  const normalizeVotedOutIds = (row: EpisodeOutcomeRow): string[] => {
    const ids = Array.isArray(row.voted_out_ids)
      ? row.voted_out_ids.filter((id): id is string => typeof id === "string" && id.trim() !== "")
      : [];
    if (ids.length > 0) return ids;
    if (typeof row.voted_out === "string" && row.voted_out.trim() !== "") {
      return [row.voted_out];
    }
    return [];
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/episode-outcomes").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/contestants").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([outcomesData, cont]) => {
        const data = outcomesData as { outcomes?: EpisodeOutcomeRow[]; current_episode?: number } | null;
        setOutcomes(Array.isArray(data?.outcomes) ? data.outcomes : []);
        setCurrentEpisode(data?.current_episode ?? 1);
        setContestants(Array.isArray(cont) ? cont.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = async (episode_id: number, voted_out_ids: string[]) => {
    setSavingEpisodeId(episode_id);
    try {
      const res = await fetch("/api/admin/episode-outcomes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id, voted_out_ids }),
      });
      if (res.ok) {
        setOutcomes((prev) =>
          prev.map((r) => (r.episode_id === episode_id ? { ...r, voted_out_ids, voted_out: voted_out_ids[0] ?? null } : r))
        );
      }
    } finally {
      setSavingEpisodeId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">Select zero, one, or multiple contestants per episode (Cmd/Ctrl-click for multi-select).</p>
      <div className="grid gap-3 md:grid-cols-2">
        {outcomes.map((row) => (
          <div key={row.episode_id} className="rounded border border-stone-700 p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-stone-300 text-sm font-medium">Ep {row.episode_id}</span>
              {savingEpisodeId === row.episode_id && (
                <span className="text-xs text-stone-500">Saving...</span>
              )}
            </div>
            <select
              multiple
              size={5}
              value={normalizeVotedOutIds(row)}
              onChange={(e) =>
                handleChange(
                  row.episode_id,
                  Array.from(e.currentTarget.selectedOptions).map((opt) => opt.value)
                )
              }
              disabled={savingEpisodeId === row.episode_id}
              className="w-full px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm disabled:opacity-50"
            >
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleChange(row.episode_id, [])}
              disabled={savingEpisodeId === row.episode_id}
              className="mt-2 text-xs px-2 py-1 rounded bg-stone-700 text-stone-300 border border-stone-600 hover:bg-stone-600 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        ))}
      </div>
      {outcomes.length === 0 && <p className="text-sm text-stone-500">No episodes loaded.</p>}
    </div>
  );
}

function PriceAdjustmentSection() {
  const [adjustmentRate, setAdjustmentRate] = useState(0.03);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [opportunityEnabled, setOpportunityEnabled] = useState(false);
  const [opportunityAlpha, setOpportunityAlpha] = useState(0);
  const [opportunityMinCoverage, setOpportunityMinCoverage] = useState(0.4);
  const [maxExternalComponentPct, setMaxExternalComponentPct] = useState(0.01);
  const [opportunityModelVersion, setOpportunityModelVersion] = useState("kalshi-v1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/price-adjustment-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        adjustment_rate?: number;
        weights?: Record<string, number>;
        opportunity_enabled?: boolean;
        opportunity_alpha?: number;
        opportunity_min_coverage?: number;
        max_external_component_pct?: number;
        opportunity_model_version?: string;
      } | null) => {
        if (data) {
          setAdjustmentRate(
            typeof data.adjustment_rate === "number" && data.adjustment_rate > 0
              ? data.adjustment_rate
              : 0.03
          );
          setWeights(typeof data.weights === "object" && data.weights !== null ? data.weights : {});
          setOpportunityEnabled(data.opportunity_enabled === true);
          setOpportunityAlpha(
            typeof data.opportunity_alpha === "number" ? data.opportunity_alpha : 0
          );
          setOpportunityMinCoverage(
            typeof data.opportunity_min_coverage === "number" ? data.opportunity_min_coverage : 0.4
          );
          setMaxExternalComponentPct(
            typeof data.max_external_component_pct === "number" ? data.max_external_component_pct : 0.01
          );
          setOpportunityModelVersion(
            typeof data.opportunity_model_version === "string" && data.opportunity_model_version.trim() !== ""
              ? data.opportunity_model_version
              : "kalshi-v1"
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setWeight = (category: string, value: number) => {
    setWeights((prev) => {
      const next = { ...prev };
      if (value === 1) {
        delete next[category];
      } else {
        next[category] = value;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/price-adjustment-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustment_rate: adjustmentRate,
          weights: Object.keys(weights).length ? weights : undefined,
          opportunity_enabled: opportunityEnabled,
          opportunity_alpha: opportunityAlpha,
          opportunity_min_coverage: opportunityMinCoverage,
          max_external_component_pct: maxExternalComponentPct,
          opportunity_model_version: opportunityModelVersion.trim() || "kalshi-v1",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-stone-300 text-sm">Adjustment rate (e.g. 0.03 = ±3% per episode)</label>
        <input
          type="number"
          min={0.01}
          max={1}
          step={0.01}
          value={adjustmentRate}
          onChange={(e) => setAdjustmentRate(Number(e.target.value) || 0.03)}
          className="w-20 px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600"
        />
      </div>
      <div>
        <p className="text-stone-400 text-sm mb-2">Category weights (default 1.0 if unset)</p>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {(POINT_BREAKDOWN_CATEGORIES as readonly string[]).map((cat) => (
            <div key={cat} className="flex items-center gap-1">
              <label className="text-stone-400 text-xs whitespace-nowrap">{cat}</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.25}
                value={weights[cat] ?? 1}
                onChange={(e) => setWeight(cat, Number(e.target.value) || 0)}
                className="w-14 px-1 py-0.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-xs"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-stone-700 pt-3 space-y-3">
        <p className="text-stone-300 text-sm font-medium">Opportunity blend (forecast signal)</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-stone-300 text-sm">
            <input
              type="checkbox"
              checked={opportunityEnabled}
              onChange={(e) => setOpportunityEnabled(e.target.checked)}
              className="rounded"
            />
            Enable external forecast blend
          </label>
          <label className="text-stone-300 text-sm">
            Alpha
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={opportunityAlpha}
              onChange={(e) => setOpportunityAlpha(Number(e.target.value) || 0)}
              className="ml-2 w-20 px-2 py-1 rounded bg-stone-700 text-stone-100 border border-stone-600"
            />
          </label>
          <label className="text-stone-300 text-sm">
            Min coverage
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={opportunityMinCoverage}
              onChange={(e) => setOpportunityMinCoverage(Number(e.target.value) || 0)}
              className="ml-2 w-20 px-2 py-1 rounded bg-stone-700 text-stone-100 border border-stone-600"
            />
          </label>
          <label className="text-stone-300 text-sm">
            Max external pct
            <input
              type="number"
              min={0}
              max={1}
              step={0.005}
              value={maxExternalComponentPct}
              onChange={(e) => setMaxExternalComponentPct(Number(e.target.value) || 0)}
              className="ml-2 w-24 px-2 py-1 rounded bg-stone-700 text-stone-100 border border-stone-600"
            />
          </label>
          <label className="text-stone-300 text-sm">
            Forecast model
            <input
              type="text"
              value={opportunityModelVersion}
              onChange={(e) => setOpportunityModelVersion(e.target.value)}
              className="ml-2 w-32 px-2 py-1 rounded bg-stone-700 text-stone-100 border border-stone-600"
            />
          </label>
        </div>
        <p className="text-xs text-stone-500">
          With alpha = 0, external forecasts are shadow-only. Increase gradually after audit validation.
        </p>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save price adjustment config"}
      </button>
    </div>
  );
}

function PriceAuditSection() {
  const [episodeCount, setEpisodeCount] = useState(MAX_EPISODES);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [contestantNames, setContestantNames] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<PriceAuditResponse | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/season").then((r) => r.json()), fetch("/api/contestants").then((r) => r.json())])
      .then(([season, contestants]) => {
        const current = (season as { current_episode?: number }).current_episode ?? 1;
        const count = Math.max(MAX_EPISODES, current);
        setEpisodeCount(count);
        setSelectedEpisode((prev) => Math.min(Math.max(1, prev), count));

        const byId: Record<string, string> = {};
        for (const c of Array.isArray(contestants) ? contestants : []) {
          const row = c as { id?: string; name?: string };
          if (row.id) byId[row.id] = row.name ?? row.id;
        }
        setContestantNames(byId);
      })
      .finally(() => setLoadingMeta(false));
  }, []);

  useEffect(() => {
    if (selectedEpisode < 1) return;
    fetch(`/api/admin/price-audit?episode=${selectedEpisode}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
              ? (body as { error: string }).error
              : res.statusText || "Failed";
          throw new Error(msg);
        }
        return (await res.json()) as PriceAuditResponse;
      })
      .then((data) => setAudit(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit"))
      .finally(() => setLoadingAudit(false));
  }, [selectedEpisode]);

  const episodes = Array.from({ length: episodeCount }, (_, i) => i + 1);

  const formatMoney = (value: number) => `$${value.toLocaleString()}`;
  const formatDelta = (value: number) => `${value >= 0 ? "+" : ""}$${value.toLocaleString()}`;
  const formatContribution = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

  const topContributions = (contributions: Record<string, number>) => {
    const ranked = Object.entries(contributions)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3);

    if (ranked.length === 0) return "—";
    return ranked.map(([label, value]) => `${label}: ${formatContribution(value)}`).join(" | ");
  };

  const contestantName = (contestantId: string) => contestantNames[contestantId] ?? contestantId;

  if (loadingMeta) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-stone-300 text-sm">Episode</label>
        <select
          value={selectedEpisode}
          onChange={(e) => {
            setError(null);
            setLoadingAudit(true);
            setSelectedEpisode(Number(e.target.value));
          }}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        >
          {episodes.map((ep) => (
            <option key={ep} value={ep}>
              Episode {ep}
            </option>
          ))}
        </select>
        {audit?.run_at ? (
          <span className="text-xs text-stone-400">
            Run: {new Date(audit.run_at).toLocaleString()} (rate {audit.adjustment_rate ?? 0})
          </span>
        ) : null}
      </div>

      {loadingAudit ? (
        <p className="text-sm text-stone-500">Loading price audit...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : !audit || audit.contestants.length === 0 ? (
        <p className="text-sm text-stone-500">No audit rows found for this episode yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-stone-400 border-b border-stone-600 sticky top-0 bg-stone-800/95 z-10">
                <th className="py-2 pr-2">Contestant</th>
                <th className="py-2 pr-2">Prev price</th>
                <th className="py-2 pr-2">New price</th>
                <th className="py-2 pr-2">Delta</th>
                <th className="py-2 pr-2">Perf ratio</th>
                <th className="py-2 pr-2">Top contributions</th>
              </tr>
            </thead>
            <tbody>
              {audit.contestants.map((row) => (
                <tr key={row.contestant_id} className="border-b border-stone-700/50">
                  <td className="py-1.5 pr-2 text-stone-200">{contestantName(row.contestant_id)}</td>
                  <td className="py-1.5 pr-2 text-stone-300">{formatMoney(row.prev_price)}</td>
                  <td className="py-1.5 pr-2 text-stone-300">{formatMoney(row.new_price)}</td>
                  <td className={`py-1.5 pr-2 ${row.price_change >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {formatDelta(row.price_change)}
                  </td>
                  <td className="py-1.5 pr-2 text-stone-300">{row.perf_ratio.toFixed(3)}</td>
                  <td className="py-1.5 pr-2 text-stone-300">{topContributions(row.category_contributions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MarketIngestSection() {
  const [status, setStatus] = useState("open");
  const [limit, setLimit] = useState(200);
  const [maxPages, setMaxPages] = useState(5);
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runIngest = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/markets/ingest/kalshi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          limit,
          max_pages: maxPages,
          dry_run: dryRun,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Failed: ${res.status}`);
      }
      setMessage(
        `Fetched ${data.fetched_count ?? 0} market(s). Upserted ${data.markets_upserted ?? 0}, snapshots ${data.snapshots_inserted ?? 0}.`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ingest failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-stone-300 text-sm">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        >
          <option value="open">open</option>
          <option value="active">active</option>
          <option value="closed">closed</option>
        </select>
        <label className="text-stone-300 text-sm">Limit</label>
        <input
          type="number"
          min={1}
          max={1000}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 200)}
          className="w-20 px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600"
        />
        <label className="text-stone-300 text-sm">Max pages</label>
        <input
          type="number"
          min={1}
          max={50}
          value={maxPages}
          onChange={(e) => setMaxPages(Number(e.target.value) || 5)}
          className="w-20 px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600"
        />
        <label className="flex items-center gap-2 text-stone-300 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded"
          />
          Dry run
        </label>
        <button
          type="button"
          onClick={runIngest}
          disabled={running}
          className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
        >
          {running ? "Running..." : "Ingest Kalshi markets"}
        </button>
      </div>
      {message ? <p className="text-sm text-stone-400">{message}</p> : null}
    </div>
  );
}

function MarketMappingsSection() {
  const [contestants, setContestants] = useState<{ id: string; name: string }[]>([]);
  const [episodeCount, setEpisodeCount] = useState(MAX_EPISODES);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [rows, setRows] = useState<MarketMappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    market_ticker: "",
    contestant_id: "",
    category: POINT_BREAKDOWN_CATEGORIES[0] as string,
    side: "yes" as "yes" | "no",
    transform: "direct" as "direct" | "inverse",
    confidence: 1,
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/contestants").then((r) => r.json()),
      fetch("/api/season").then((r) => r.json()),
    ])
      .then(([cont, season]) => {
        const contestList = Array.isArray(cont) ? (cont as { id: string; name: string }[]) : [];
        setContestants(contestList);
        if (contestList.length > 0) {
          setForm((prev) => ({
            ...prev,
            contestant_id: prev.contestant_id || contestList[0].id,
          }));
        }
        const current = (season as { current_episode?: number }).current_episode ?? 1;
        setEpisodeCount(Math.max(MAX_EPISODES, current + 1));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`/api/admin/market-mappings?episode=${selectedEpisode}&include_inactive=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MarketMappingRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, [selectedEpisode]);

  const saveMapping = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/market-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "kalshi",
          market_ticker: form.market_ticker.trim(),
          episode_id: selectedEpisode,
          contestant_id: form.contestant_id,
          category: form.category,
          side: form.side,
          transform: form.transform,
          confidence: form.confidence,
          notes: form.notes.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `Failed: ${res.status}`);
      }
      setRows((prev) => {
        const row = body as MarketMappingRow;
        const without = prev.filter((r) => r.id !== row.id);
        return [...without, row].sort((a, b) => a.contestant_id.localeCompare(b.contestant_id));
      });
      setForm((prev) => ({ ...prev, market_ticker: "", notes: "" }));
      setMessage("Mapping saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save mapping.");
    } finally {
      setSaving(false);
    }
  };

  const deleteMapping = async (id: string) => {
    const res = await fetch(`/api/admin/market-mappings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const contestantName = (id: string) => contestants.find((c) => c.id === id)?.name ?? id;
  const episodes = Array.from({ length: episodeCount }, (_, i) => i + 1);

  if (loading) return <p className="text-sm text-stone-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-stone-300 text-sm">Episode</label>
        <select
          value={selectedEpisode}
          onChange={(e) => setSelectedEpisode(Number(e.target.value))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        >
          {episodes.map((ep) => (
            <option key={ep} value={ep}>
              Episode {ep}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Market ticker"
          value={form.market_ticker}
          onChange={(e) => setForm((prev) => ({ ...prev, market_ticker: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm w-44"
        />
        <select
          value={form.contestant_id}
          onChange={(e) => setForm((prev) => ({ ...prev, contestant_id: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm min-w-[140px]"
        >
          {contestants.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={form.category}
          onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm min-w-[170px]"
        >
          {POINT_BREAKDOWN_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={form.side}
          onChange={(e) => setForm((prev) => ({ ...prev, side: e.target.value as "yes" | "no" }))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </select>
        <select
          value={form.transform}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, transform: e.target.value as "direct" | "inverse" }))
          }
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        >
          <option value="direct">direct</option>
          <option value="inverse">inverse</option>
        </select>
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={form.confidence}
          onChange={(e) => setForm((prev) => ({ ...prev, confidence: Number(e.target.value) || 0 }))}
          className="w-20 px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        />
        <button
          type="button"
          onClick={saveMapping}
          disabled={saving}
          className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Add mapping"}
        </button>
      </div>
      <input
        type="text"
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        className="w-full px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
      />
      {message ? <p className="text-sm text-stone-400">{message}</p> : null}

      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-stone-400 border-b border-stone-600 sticky top-0 bg-stone-800/95 z-10">
              <th className="py-2 pr-2">Contestant</th>
              <th className="py-2 pr-2">Ticker</th>
              <th className="py-2 pr-2">Category</th>
              <th className="py-2 pr-2">Side</th>
              <th className="py-2 pr-2">Transform</th>
              <th className="py-2 pr-2">Conf</th>
              <th className="py-2 pr-2">Active</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-stone-700/50">
                <td className="py-1.5 pr-2 text-stone-200">{contestantName(row.contestant_id)}</td>
                <td className="py-1.5 pr-2 text-stone-300">{row.market_ticker}</td>
                <td className="py-1.5 pr-2 text-stone-300">{row.category}</td>
                <td className="py-1.5 pr-2 text-stone-300">{row.side}</td>
                <td className="py-1.5 pr-2 text-stone-300">{row.transform}</td>
                <td className="py-1.5 pr-2 text-stone-300">{row.confidence}</td>
                <td className="py-1.5 pr-2 text-stone-300">{row.is_active ? "yes" : "no"}</td>
                <td className="py-1.5 pr-2">
                  <button
                    type="button"
                    onClick={() => deleteMapping(row.id)}
                    className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-200 hover:bg-red-800/50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="py-2 text-stone-500" colSpan={8}>
                  No mappings for this episode.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ForecastsSection() {
  const [episodeCount, setEpisodeCount] = useState(MAX_EPISODES);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [modelVersion, setModelVersion] = useState("kalshi-v1");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [runAt, setRunAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((season) => {
        const current = (season as { current_episode?: number }).current_episode ?? 1;
        setEpisodeCount(Math.max(MAX_EPISODES, current + 1));
      })
      .finally(() => setLoading(false));
  }, []);

  const loadForecasts = useCallback(async () => {
    const res = await fetch(
      `/api/admin/forecasts?episode=${selectedEpisode}&model=${encodeURIComponent(modelVersion)}`
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : `Failed: ${res.status}`);
    }
    setRows(Array.isArray(body.forecasts) ? (body.forecasts as ForecastRow[]) : []);
    setRunAt(typeof body.run_at === "string" ? body.run_at : null);
  }, [selectedEpisode, modelVersion]);

  useEffect(() => {
    loadForecasts().catch(() => {
      setRows([]);
      setRunAt(null);
    });
  }, [loadForecasts]);

  const materialize = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/forecasts/materialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: selectedEpisode, model: modelVersion }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `Failed: ${res.status}`);
      }
      setMessage(
        `Materialized ${body.rowCount ?? 0} row(s), skipped ${body.skippedCount ?? 0}, mappings ${body.mappingCount ?? 0}.`
      );
      await loadForecasts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to materialize forecasts.");
    } finally {
      setRunning(false);
    }
  };

  const episodes = Array.from({ length: episodeCount }, (_, i) => i + 1);
  if (loading) return <p className="text-sm text-stone-500">Loading...</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-stone-300 text-sm">Episode</label>
        <select
          value={selectedEpisode}
          onChange={(e) => setSelectedEpisode(Number(e.target.value))}
          className="px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        >
          {episodes.map((ep) => (
            <option key={ep} value={ep}>
              Episode {ep}
            </option>
          ))}
        </select>
        <label className="text-stone-300 text-sm">Model</label>
        <input
          type="text"
          value={modelVersion}
          onChange={(e) => setModelVersion(e.target.value)}
          className="w-32 px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600 text-sm"
        />
        <button
          type="button"
          onClick={materialize}
          disabled={running}
          className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
        >
          {running ? "Running..." : "Materialize forecasts"}
        </button>
        {runAt ? (
          <span className="text-xs text-stone-400">Last run: {new Date(runAt).toLocaleString()}</span>
        ) : null}
      </div>
      {message ? <p className="text-sm text-stone-400">{message}</p> : null}

      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-stone-400 border-b border-stone-600 sticky top-0 bg-stone-800/95 z-10">
              <th className="py-2 pr-2">Contestant</th>
              <th className="py-2 pr-2">Category</th>
              <th className="py-2 pr-2">Probability</th>
              <th className="py-2 pr-2">Expected value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.contestant_id}-${row.category}-${idx}`} className="border-b border-stone-700/50">
                <td className="py-1.5 pr-2 text-stone-200">{row.contestant_name}</td>
                <td className="py-1.5 pr-2 text-stone-300">{row.category}</td>
                <td className="py-1.5 pr-2 text-stone-300">
                  {row.probability == null ? "—" : row.probability.toFixed(3)}
                </td>
                <td className="py-1.5 pr-2 text-stone-300">
                  {row.expected_value == null ? "—" : row.expected_value.toFixed(3)}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="py-2 text-stone-500" colSpan={4}>
                  No forecasts found for this episode/model.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [currentEpisode, setCurrentEpisode] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [materializing, setMaterializing] = useState(false);
  const [materializeMessage, setMaterializeMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => setCurrentEpisode(d.current_episode ?? 1))
      .catch(() => {});
  }, []);

  const handleSetEpisode = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_episode: currentEpisode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed: ${res.status}`);
      }
      setMessage("Current week updated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const handleMaterialize = async () => {
    setMaterializing(true);
    setMaterializeMessage(null);
    try {
      const res = await fetch("/api/admin/materialize", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Failed: ${res.status}`);
      }
      const prices = data.prices as { episodeCount?: number; rowCount?: number } | undefined;
      const points = data.points as { episodeCount?: number; rowCount?: number } | undefined;
      const parts: string[] = [];
      if (prices) parts.push(`Prices: ${prices.rowCount ?? 0} rows for ${prices.episodeCount ?? 0} episode(s)`);
      if (points) parts.push(`Points: ${points.rowCount ?? 0} rows for ${points.episodeCount ?? 0} episode(s)`);
      setMaterializeMessage(parts.length ? parts.join(". ") : "Done.");
    } catch (e) {
      setMaterializeMessage(e instanceof Error ? e.message : "Materialize failed.");
    } finally {
      setMaterializing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Admin Dashboard</h1>
        <p className="text-stone-400 text-sm mt-1">
          Season, points, pricing, traits, and home content.
        </p>
      </div>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">
          Season / Current week
        </h2>
        <p className="text-sm text-stone-400 mb-3">
          This controls which episode the Points tab shows and which team Pick Team/Transfers use.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-stone-300 text-sm">Current episode</label>
          <input
            type="number"
            min={0}
            max={99}
            value={currentEpisode}
            onChange={(e) => setCurrentEpisode(Number(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 rounded bg-stone-700 text-stone-100 border border-stone-600"
          />
          <button
            type="button"
            onClick={handleSetEpisode}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {message && (
            <span className="text-sm text-stone-400">{message}</span>
          )}
        </div>
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">
          Materialize prices &amp; points
        </h2>
        <p className="text-sm text-stone-400 mb-3">
          Run this after changing current episode, point overrides, or contestant base prices. It fills the canonical tables (contestant_episode_prices, contestant_episode_points) so Stats, Transfers, Points, and Leaderboard all show the same data. Run once after running the migration if the new tables are empty.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleMaterialize}
            disabled={materializing}
            className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
          >
            {materializing ? "Running…" : "Materialize prices & points"}
          </button>
          {materializeMessage && (
            <span className="text-sm text-stone-400">{materializeMessage}</span>
          )}
        </div>
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">
          Episode outcomes / Voted out
        </h2>
        <p className="text-sm text-stone-400 mb-3">
          Set who was voted out each episode (supports multiple eliminations). Player cards will be grayed out and show &quot;Voted out&quot; everywhere once set. Run Materialize after changing outcomes if you want points/prices updated.
        </p>
        <EpisodeOutcomesSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Point overrides by category</h2>
        <p className="text-sm text-stone-400 mb-3">
          Set point overrides per contestant, episode, and category. Each row overrides (or adds) that category in the point breakdown. Episode total is recomputed from all sources.
        </p>
        <PointCategoryOverridesSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Idol / Advantage / Clue counts</h2>
        <p className="text-sm text-stone-400 mb-3">
          Set idol, advantage, and clue counts per contestant. These appear on the Pick Team character cards.
        </p>
        <PossessionsSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Pricing & Traits</h2>
        <p className="text-sm text-stone-400 mb-3">
          Edit base price and trait scores (Cognition, Strategy, Influence, Resilience 1–100) per contestant.
        </p>
        <PricingAndTraitsSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Price adjustment (repricing)</h2>
        <p className="text-sm text-stone-400 mb-3">
          Category weights and adjustment rate for the dynamic repricing formula. Weighted performance score is computed from point breakdown; above-average raises price, below-average lowers it. Default weight 1.0 for categories not set.
        </p>
        <PriceAdjustmentSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <details className="space-y-3">
          <summary className="text-lg font-semibold text-stone-200 cursor-pointer">
            Price Audit
          </summary>
          <p className="text-sm text-stone-400">
            Inspect why prices changed by episode: previous/new price, performance ratio, and top weighted category contributions.
          </p>
          <PriceAuditSection />
        </details>
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Prediction markets ingest</h2>
        <p className="text-sm text-stone-400 mb-3">
          Pull current Kalshi market data into local snapshot tables for forecasting.
        </p>
        <MarketIngestSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Prediction market mappings</h2>
        <p className="text-sm text-stone-400 mb-3">
          Map market tickers to contestant/category opportunities for a target episode.
        </p>
        <MarketMappingsSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Opportunity forecasts</h2>
        <p className="text-sm text-stone-400 mb-3">
          Materialize expected values from mapped market probabilities and preview per contestant/category rows.
        </p>
        <ForecastsSection />
      </section>

      <section className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h2 className="text-lg font-semibold text-stone-200 mb-2">Home content</h2>
        <p className="text-sm text-stone-400 mb-3">
          Add and edit articles/pages shown on the home page. Published items appear in the Survivor Fantasy section.
        </p>
        <HomeContentSection />
      </section>

      <p className="text-sm text-stone-500">
        <Link href="/" className="text-orange-400 hover:underline">Back to Home</Link>
      </p>
    </div>
  );
}
