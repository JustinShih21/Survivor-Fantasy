import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";

type OverrideRow = { contestant_id: string; episode_id: number; category: string; points: number };

const store: OverrideRow[] = [];

function createChain(initialData: OverrideRow[] = store) {
  const data = [...initialData];
  let episodeFilter: number | null = null;
  const chain = {
    order: () => chain,
    eq: (col: string, val: number) => {
      if (col === "episode_id") episodeFilter = val;
      return chain;
    },
    then: (onFulfilled: (v: { data: OverrideRow[]; error: null }) => unknown) => {
      let out = data;
      if (episodeFilter != null) {
        out = data.filter((r) => r.episode_id === episodeFilter);
      }
      return Promise.resolve({ data: out, error: null }).then(onFulfilled);
    },
    catch: (fn: (err: unknown) => unknown) => Promise.resolve({ data: data, error: null }).catch(fn),
  };
  return chain;
}

function createDeleteChain() {
  return {
    eq: (col: string, val: string | number) => createDeleteChain(),
    then: (onFulfilled: (v: { error: null }) => unknown) => {
      return Promise.resolve({ error: null }).then(onFulfilled);
    },
    catch: (fn: (err: unknown) => unknown) => Promise.resolve({ error: null }).catch(fn),
  };
}

function createUpsertChain(payload: OverrideRow) {
  return {
    select: () => ({ single: () => createUpsertChain(payload) }),
    then: (onFulfilled: (v: { data: OverrideRow; error: null }) => unknown) => {
      const idx = store.findIndex(
        (r) =>
          r.contestant_id === payload.contestant_id &&
          r.episode_id === payload.episode_id &&
          r.category === payload.category
      );
      if (idx >= 0) store[idx] = payload;
      else store.push(payload);
      return Promise.resolve({ data: payload, error: null }).then(onFulfilled);
    },
    catch: (fn: (err: unknown) => unknown) =>
      Promise.resolve({ data: payload, error: null }).catch(fn),
  };
}

vi.mock("@/lib/getUser", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ user_id: "test-user", supabase: {} }),
}));
vi.mock("@/lib/admin", () => ({
  isAdmin: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== "point_category_overrides") throw new Error("unexpected table");
      return {
        select: () => createChain(),
        order: () => createChain(),
        delete: () => {
          let cid: string | null = null;
          let eid: number | null = null;
          let cat: string | null = null;
          return {
            eq: (col: string, val: string | number) => {
              if (col === "contestant_id") cid = String(val);
              if (col === "episode_id") eid = Number(val);
              if (col === "category") cat = String(val);
              return {
                eq: (col2: string, val2: string | number) => {
                  if (col2 === "contestant_id") cid = String(val2);
                  if (col2 === "episode_id") eid = Number(val2);
                  if (col2 === "category") cat = String(val2);
                  return {
                    eq: (col3: string, val3: string | number) => {
                      if (col3 === "contestant_id") cid = String(val3);
                      if (col3 === "episode_id") eid = Number(val3);
                      if (col3 === "category") cat = String(val3);
                      if (cid != null && eid != null && cat != null) {
                        const i = store.findIndex(
                          (r) => r.contestant_id === cid && r.episode_id === eid && r.category === cat
                        );
                        if (i >= 0) store.splice(i, 1);
                      }
                      return createDeleteChain();
                    },
                  };
                },
              };
            },
          };
        },
        upsert: (row: OverrideRow, _opts: unknown) => createUpsertChain(row),
      };
    },
  })),
}));

describe("GET /api/admin/point-category-overrides", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("returns 401 when not authenticated", async () => {
    const { getAuthenticatedUser } = await import("@/lib/getUser");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/admin/point-category-overrides") as NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    const { isAdmin } = await import("@/lib/admin");
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    const res = await GET(new Request("http://localhost/api/admin/point-category-overrides") as NextRequest);
    expect(res.status).toBe(403);
  });

  it("returns empty array when no overrides", async () => {
    const res = await GET(new Request("http://localhost/api/admin/point-category-overrides") as NextRequest);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(0);
  });

  it("returns overrides filtered by episode_id when provided", async () => {
    store.push(
      { contestant_id: "c01", episode_id: 1, category: "Survival", points: 5 },
      { contestant_id: "c02", episode_id: 2, category: "Survival", points: 10 }
    );
    const res = await GET(
      new Request("http://localhost/api/admin/point-category-overrides?episode_id=1") as NextRequest
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0]).toEqual({ contestant_id: "c01", episode_id: 1, category: "Survival", points: 5 });
  });
});

describe("POST /api/admin/point-category-overrides", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("returns 400 when category is invalid", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/point-category-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestant_id: "c01",
          episode_id: 1,
          category: "Invalid Category",
          points: 5,
        }),
      }) as NextRequest
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when contestant_id, episode_id, or category missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/point-category-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: 1, category: "Survival", points: 5 }),
      }) as NextRequest
    );
    expect(res.status).toBe(400);
  });

  it("upserts and returns the row for valid body", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/point-category-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestant_id: "c01",
          episode_id: 1,
          category: "Survival",
          points: 5,
        }),
      }) as NextRequest
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ contestant_id: "c01", episode_id: 1, category: "Survival", points: 5 });
    expect(store).toHaveLength(1);
    expect(store[0]).toEqual(json);
  });

  it("deletes override when points is null and returns points: null", async () => {
    store.push({ contestant_id: "c01", episode_id: 1, category: "Survival", points: 5 });
    const res = await POST(
      new Request("http://localhost/api/admin/point-category-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestant_id: "c01",
          episode_id: 1,
          category: "Survival",
          points: null,
        }),
      }) as NextRequest
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.points).toBeNull();
    expect(store).toHaveLength(0);
  });
});

describe("DELETE /api/admin/point-category-overrides", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("returns 400 when query params missing", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/admin/point-category-overrides") as NextRequest
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is invalid", async () => {
    const res = await DELETE(
      new Request(
        "http://localhost/api/admin/point-category-overrides?contestant_id=c01&episode_id=1&category=Invalid"
      ) as NextRequest
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 and ok: true and removes row", async () => {
    store.push({ contestant_id: "c01", episode_id: 1, category: "Survival", points: 5 });
    const res = await DELETE(
      new Request(
        "http://localhost/api/admin/point-category-overrides?contestant_id=c01&episode_id=1&category=Survival"
      ) as NextRequest
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(store).toHaveLength(0);
  });
});
