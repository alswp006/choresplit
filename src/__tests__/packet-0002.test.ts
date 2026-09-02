import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  ChoreSplitState,
  Settings,
  CheckIn,
  SaveResult,
} from "@/lib/types";

/**
 * AC-1: Invalid JSON should return DEFAULT_STATE without error
 * - localStorage has invalid JSON '{invalid json'
 * - loadState() returns DEFAULT_STATE with settings.reminderHour === 21, penaltyEnabled === true
 * - console.error is never called
 */
describe("AC-1: loadState with invalid JSON", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    consoleErrorSpy = vi.spyOn(console, "error");
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("AC-1[P0]: should return DEFAULT_STATE when localStorage has invalid JSON", async () => {
    // Setup: inject invalid JSON
    localStorage.setItem("choresplit:v1", "{invalid json");

    // Need to import after setup (dynamic import to test error handling)
    const { loadState } = await import("@/lib/storage");

    // Action
    const result = loadState();

    // Assertions
    expect(result.version).toBe(1);
    expect(result.settings.reminderHour).toBe(21);
    expect(result.settings.penaltyEnabled).toBe(true);
    expect(result.household).toBeNull();
    expect(result.members).toEqual([]);
    expect(result.chores).toEqual([]);
    expect(result.checkIns).toEqual([]);
    expect(result.settlements).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("AC-1[P0]: should return DEFAULT_STATE when localStorage key is missing", async () => {
    // Setup: no key in localStorage (already cleared)
    const { loadState } = await import("@/lib/storage");

    // Action
    const result = loadState();

    // Assertions
    expect(result.settings.reminderHour).toBe(21);
    expect(result.settings.penaltyEnabled).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("AC-1: should return DEFAULT_STATE when version mismatch", async () => {
    // Setup: different version in localStorage
    const stateWithDifferentVersion = {
      version: 2,
      household: null,
      members: [],
      chores: [],
      checkIns: [],
      settings: { reminderEnabled: true, reminderHour: 20, penaltyEnabled: false, lastReminderShownDate: null },
      settlements: [],
    };
    localStorage.setItem("choresplit:v1", JSON.stringify(stateWithDifferentVersion));

    const { loadState } = await import("@/lib/storage");

    // Action
    const result = loadState();

    // Assertions: should fall back to DEFAULT_STATE
    expect(result.settings.reminderHour).toBe(21);
    expect(result.settings.penaltyEnabled).toBe(true);
  });
});

/**
 * AC-2: QuotaExceededError from localStorage.setItem should be caught and return error SaveResult
 * - saveState() does not throw
 * - Returns { ok: false, error: '저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요' }
 */
describe("AC-2: saveState with QuotaExceededError", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("AC-2[P0]: should catch QuotaExceededError and return error SaveResult", async () => {
    const { saveState } = await import("@/lib/storage");

    // Setup: spy on localStorage.setItem and make it throw
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const error = new Error();
      error.name = "QuotaExceededError";
      throw error;
    });

    const dummyState: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [],
      settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
      settlements: [],
    };

    // Action
    const result = saveState(dummyState);

    // Assertions
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요");
    }

    // Cleanup
    setItemSpy.mockRestore();
  });

  it("AC-2: should return { ok: true } when save succeeds", async () => {
    const { saveState } = await import("@/lib/storage");

    const dummyState: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [],
      settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
      settlements: [],
    };

    // Action
    const result = saveState(dummyState);

    // Assertions
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result).toEqual({ ok: true });
    }
  });
});

/**
 * AC-3: checkIns older than 120 days should be pruned during save
 * - saveState() removes checkIns with date > 120 days old
 * - checkIns within 120 days are preserved
 */
describe("AC-3: checkIns pruning (120 days)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("AC-3[P0]: should remove checkIns older than 120 days and keep those within 120 days", async () => {
    const { saveState, loadState, todayKST } = await import("@/lib/storage");

    // NOTE: toISOString() converts to UTC and can shift the calendar date by one
    // day relative to local/KST time (e.g. KST 05:00 is still the previous day in
    // UTC), producing an off-by-one vs. production's KST-based pruneOlderThan().
    // Use local date components (matches todayKST()'s own local-time approach)
    // instead of toISOString() to compute "N days ago" as a KST YYYY-MM-DD string.
    const toDateKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const today = todayKST();
    const date120DaysAgo = new Date(new Date().setDate(new Date().getDate() - 120));
    const dateKST120 = toDateKey(date120DaysAgo);

    const date121DaysAgo = new Date(new Date().setDate(new Date().getDate() - 121));
    const dateKST121 = toDateKey(date121DaysAgo);

    const date30DaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const dateKST30 = toDateKey(date30DaysAgo);

    // Setup: state with checkIns at various ages
    const stateWithCheckIns: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [
        {
          id: `${dateKST121}__c_12345678__m_abcdefgh`,
          date: dateKST121,
          choreId: "c_12345678",
          memberId: "m_abcdefgh",
          weightAtLog: 1,
          createdAt: new Date(dateKST121).toISOString(),
        },
        {
          id: `${dateKST120}__c_87654321__m_abcdefgh`,
          date: dateKST120,
          choreId: "c_87654321",
          memberId: "m_abcdefgh",
          weightAtLog: 2,
          createdAt: new Date(dateKST120).toISOString(),
        },
        {
          id: `${dateKST30}__c_aaaaaaaa__m_abcdefgh`,
          date: dateKST30,
          choreId: "c_aaaaaaaa",
          memberId: "m_abcdefgh",
          weightAtLog: 3,
          createdAt: new Date(dateKST30).toISOString(),
        },
        {
          id: `${today}__c_bbbbbbbb__m_abcdefgh`,
          date: today,
          choreId: "c_bbbbbbbb",
          memberId: "m_abcdefgh",
          weightAtLog: 1,
          createdAt: new Date().toISOString(),
        },
      ],
      settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
      settlements: [],
    };

    // Action: save (should prune 121+ days old)
    saveState(stateWithCheckIns);

    // Action: load to verify
    const loadedState = loadState();

    // Assertions
    expect(loadedState.checkIns).toHaveLength(3); // 121-day old should be removed
    expect(loadedState.checkIns.some((c) => c.date === dateKST121)).toBe(false);
    expect(loadedState.checkIns.some((c) => c.date === dateKST120)).toBe(true);
    expect(loadedState.checkIns.some((c) => c.date === dateKST30)).toBe(true);
    expect(loadedState.checkIns.some((c) => c.date === today)).toBe(true);
  });
});

/**
 * AC-4: ID and code generation should follow specific formats
 * - newId('m_') returns /^m_[a-z0-9]{8}$/ (tested 100x)
 * - newId('c_') returns /^c_[a-z0-9]{8}$/ (tested 100x)
 * - generateInviteCode() returns /^[A-Z0-9]{6}$/ (tested 100x)
 */
describe("AC-4: ID and code generation formats", () => {
  it("AC-4: newId('m_') matches /^m_[a-z0-9]{8}$/ for 100 calls", async () => {
    const { newId } = await import("@/lib/storage");

    const pattern = /^m_[a-z0-9]{8}$/;
    for (let i = 0; i < 100; i++) {
      const id = newId("m_");
      expect(id).toMatch(pattern);
    }
  });

  it("AC-4: newId('c_') matches /^c_[a-z0-9]{8}$/ for 100 calls", async () => {
    const { newId } = await import("@/lib/storage");

    const pattern = /^c_[a-z0-9]{8}$/;
    for (let i = 0; i < 100; i++) {
      const id = newId("c_");
      expect(id).toMatch(pattern);
    }
  });

  it("AC-4: generateInviteCode() matches /^[A-Z0-9]{6}$/ for 100 calls", async () => {
    const { generateInviteCode } = await import("@/lib/storage");

    const pattern = /^[A-Z0-9]{6}$/;
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(pattern);
    }
  });
});

/**
 * AC-5: pruneOlderThan should mutate the result but not modify the input
 * - Input state remains unchanged (JSON.stringify before/after identical)
 * - Source code must not use: Array.prototype.at, Object.groupBy, structuredClone, findLast
 */
describe("AC-5: pruneOlderThan immutability and API constraints", () => {
  it("AC-5[P0]: pruneOlderThan(state, 30) should not modify input state", async () => {
    const { pruneOlderThan, todayKST } = await import("@/lib/storage");

    const today = todayKST();
    const date30DaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const dateKST30 = date30DaysAgo.toISOString().split("T")[0];

    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [
        {
          id: `${dateKST30}__c_12345678__m_abcdefgh`,
          date: dateKST30,
          choreId: "c_12345678",
          memberId: "m_abcdefgh",
          weightAtLog: 1,
          createdAt: new Date(dateKST30).toISOString(),
        },
        {
          id: `${today}__c_87654321__m_abcdefgh`,
          date: today,
          choreId: "c_87654321",
          memberId: "m_abcdefgh",
          weightAtLog: 2,
          createdAt: new Date().toISOString(),
        },
      ],
      settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
      settlements: [],
    };

    // Capture state before
    const stateBefore = JSON.stringify(state);

    // Action
    const prunedState = pruneOlderThan(state, 30);

    // Capture state after
    const stateAfter = JSON.stringify(state);

    // Assertions
    expect(stateBefore).toBe(stateAfter); // input unchanged
    expect(prunedState.checkIns.length).toBeLessThanOrEqual(state.checkIns.length);
  });

  it("AC-5: pruneOlderThan should remove checkIns older than N days", async () => {
    const { pruneOlderThan, todayKST } = await import("@/lib/storage");

    const today = todayKST();
    const date35DaysAgo = new Date(new Date().setDate(new Date().getDate() - 35));
    const dateKST35 = date35DaysAgo.toISOString().split("T")[0];

    const date25DaysAgo = new Date(new Date().setDate(new Date().getDate() - 25));
    const dateKST25 = date25DaysAgo.toISOString().split("T")[0];

    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [
        {
          id: `${dateKST35}__c_12345678__m_abcdefgh`,
          date: dateKST35,
          choreId: "c_12345678",
          memberId: "m_abcdefgh",
          weightAtLog: 1,
          createdAt: new Date(dateKST35).toISOString(),
        },
        {
          id: `${dateKST25}__c_87654321__m_abcdefgh`,
          date: dateKST25,
          choreId: "c_87654321",
          memberId: "m_abcdefgh",
          weightAtLog: 2,
          createdAt: new Date(dateKST25).toISOString(),
        },
        {
          id: `${today}__c_aaaaaaaa__m_abcdefgh`,
          date: today,
          choreId: "c_aaaaaaaa",
          memberId: "m_abcdefgh",
          weightAtLog: 1,
          createdAt: new Date().toISOString(),
        },
      ],
      settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
      settlements: [],
    };

    // Action: prune items older than 30 days
    const prunedState = pruneOlderThan(state, 30);

    // Assertions
    expect(prunedState.checkIns).toHaveLength(2); // 35-day old removed
    expect(prunedState.checkIns.some((c) => c.date === dateKST35)).toBe(false);
    expect(prunedState.checkIns.some((c) => c.date === dateKST25)).toBe(true);
    expect(prunedState.checkIns.some((c) => c.date === today)).toBe(true);
  });
});

/**
 * Additional functionality: onboarded, unlocked states, date utilities
 */
describe("Additional storage functions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("setOnboarded and isOnboarded", async () => {
    const { setOnboarded, isOnboarded } = await import("@/lib/storage");

    expect(isOnboarded()).toBe(false);
    setOnboarded();
    expect(isOnboarded()).toBe(true);
  });

  it("loadUnlocked and unlockWeek", async () => {
    const { loadUnlocked, unlockWeek } = await import("@/lib/storage");

    const unlocked1 = loadUnlocked();
    expect(unlocked1).toEqual({});

    unlockWeek("2026-01-06"); // Monday
    const unlocked2 = loadUnlocked();
    expect(unlocked2).toEqual({ "2026-01-06": true });

    unlockWeek("2026-01-13");
    const unlocked3 = loadUnlocked();
    expect(unlocked3).toEqual({ "2026-01-06": true, "2026-01-13": true });
  });

  it("todayKST returns YYYY-MM-DD format", async () => {
    const { todayKST } = await import("@/lib/storage");

    const today = todayKST();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formatDateKST formats date correctly", async () => {
    const { formatDateKST } = await import("@/lib/storage");

    const formatted = formatDateKST("2026-01-15");
    expect(typeof formatted).toBe("string");
    // Should be human-readable format (e.g., "1월 15일" or similar)
    expect(formatted.length).toBeGreaterThan(0);
  });
});
