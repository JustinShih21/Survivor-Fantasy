import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";

const hoisted = vi.hoisted(() => {
  const leagueStore: { id: string; name: string; invite_code: string; created_by: string; created_at?: string }[] = [];
  const memberStore: { league_id: string; user_id: string }[] = [];
  const insertLeagueCalls: { name: string; invite_code: string; created_by: string }[] = [];
  const insertMemberCalls: { league_id: string; user_id: string }[] = [];
  const mockSupabase = {
    from: (table: string) => {
      if (table === "league_members") {
        return {
          select: () => ({
            eq: (_col: string, userId: string) =>
              Promise.resolve({
                data: memberStore.filter((m) => m.user_id === userId).map((m) => ({ league_id: m.league_id })),
                error: null,
              }),
            in: (_col: string, ids: string[]) =>
              Promise.resolve({
                data: memberStore.filter((m) => ids.includes(m.league_id)),
                error: null,
              }),
        }),
        insert: (row: { league_id: string; user_id: string }) => {
          insertMemberCalls.push(row);
          memberStore.push(row);
          return Promise.resolve({ error: null });
        },
      };
    }
    if (table === "leagues") {
      return {
        select: () => ({
          in: (_col: string, ids: string[]) =>
            Promise.resolve({
              data: leagueStore.filter((l) => ids.includes(l.id)),
              error: null,
            }),
        }),
        insert: (row: { name: string; invite_code: string; created_by: string }) => {
          insertLeagueCalls.push(row);
          const newLeague = {
            id: `league-${Date.now()}`,
            name: row.name,
            invite_code: row.invite_code,
            created_by: row.created_by,
            created_at: new Date().toISOString(),
          };
          leagueStore.push(newLeague);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: newLeague, error: null }),
            }),
          };
        },
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  }
};
  return {
    leagueStore,
    memberStore,
    insertLeagueCalls,
    insertMemberCalls,
    mockSupabase,
    TEST_USER_ID: "user-123",
  };
});

vi.mock("@/lib/getUser", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    user_id: hoisted.TEST_USER_ID,
    supabase: hoisted.mockSupabase,
  }),
}));

const TEST_USER_ID = hoisted.TEST_USER_ID;

describe("GET /api/leagues", () => {
  beforeEach(() => {
    hoisted.leagueStore.length = 0;
    hoisted.memberStore.length = 0;
    const leagueId = "league-get-test";
    hoisted.leagueStore.push({
      id: leagueId,
      name: "Test League",
      invite_code: "ABC123",
      created_by: TEST_USER_ID,
      created_at: new Date().toISOString(),
    });
    hoisted.memberStore.push({ league_id: leagueId, user_id: TEST_USER_ID });
  });

  it("returns 401 when not authenticated", async () => {
    const { getAuthenticatedUser } = await import("@/lib/getUser");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns user leagues with member_count", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leagues).toBeDefined();
    expect(Array.isArray(data.leagues)).toBe(true);
    expect(data.leagues.length).toBeGreaterThanOrEqual(1);
    const league = data.leagues.find((l: { id: string }) => l.id === "league-get-test");
    expect(league).toBeDefined();
    expect(league?.name).toBe("Test League");
    expect(league?.invite_code).toBe("ABC123");
    expect(league?.member_count).toBe(1);
  });

  it("returns empty leagues when user has no memberships", async () => {
    hoisted.memberStore.length = 0;
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leagues).toEqual([]);
  });
});

describe("POST /api/leagues", () => {
  beforeEach(() => {
    hoisted.leagueStore.length = 0;
    hoisted.memberStore.length = 0;
    hoisted.insertLeagueCalls.length = 0;
    hoisted.insertMemberCalls.length = 0;
  });

  it("returns 401 when not authenticated", async () => {
    const { getAuthenticatedUser } = await import("@/lib/getUser");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://localhost/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New League" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing or empty", async () => {
    const res1 = await POST(
      new Request("http://localhost/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res1.status).toBe(400);

    const res2 = await POST(
      new Request("http://localhost/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      })
    );
    expect(res2.status).toBe(400);
  });

  it("creates league and adds creator to league_members", async () => {
    const res = await POST(
      new Request("http://localhost/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My New League" }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.league).toBeDefined();
    expect(data.league.name).toBe("My New League");
    expect(data.league.invite_code).toMatch(/^[A-Z0-9]{6}$/);
    expect(data.league.created_by).toBe(TEST_USER_ID);

    expect(hoisted.insertLeagueCalls.length).toBe(1);
    expect(hoisted.insertLeagueCalls[0].name).toBe("My New League");
    expect(hoisted.insertLeagueCalls[0].created_by).toBe(TEST_USER_ID);

    expect(hoisted.insertMemberCalls.length).toBe(1);
    expect(hoisted.insertMemberCalls[0].league_id).toBe(data.league.id);
    expect(hoisted.insertMemberCalls[0].user_id).toBe(TEST_USER_ID);
  });
});
