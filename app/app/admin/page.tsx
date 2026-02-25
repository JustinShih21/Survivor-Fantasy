"use client";

import { useState, useEffect } from "react";
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

export default function AdminPage() {
  const [currentEpisode, setCurrentEpisode] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
