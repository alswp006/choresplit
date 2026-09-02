import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ChoreSplitState, Settings } from "@/lib/types";
import {
  getStreak,
  getRanking,
  countTodayCheckIns,
  shouldShowReminder,
} from "@/lib/streak";

/**
 * Test suite for Packet 0005: Streak & Ranking Calculation + Reminder Logic
 *
 * Pure function tests — no mocks needed
 */

describe("Streak & Ranking Calculation + Reminder Logic", () => {
  const makeState = (
    overrides: Partial<ChoreSplitState> = {}
  ): ChoreSplitState => ({
    version: 1,
    household: null,
    members: [
      { id: "m_me", name: "Me", colorToken: "blue", isMe: true, createdAt: "2026-01-01T00:00:00Z" },
      { id: "m_other1", name: "Alice", colorToken: "green", isMe: false, createdAt: "2026-01-01T00:00:00Z" },
      { id: "m_other2", name: "Bob", colorToken: "orange", isMe: false, createdAt: "2026-01-01T00:00:00Z" },
    ],
    chores: [],
    checkIns: [],
    settings: {
      reminderEnabled: true,
      reminderHour: 21,
      penaltyEnabled: true,
      lastReminderShownDate: null,
    },
    settlements: [],
    ...overrides,
  });

  const checkIn = (
    date: string,
    memberId: string,
    weightAtLog: 1 | 2 | 3 = 1,
    choreId = "c1"
  ) => ({
    id: `${date}__${choreId}__${memberId}`,
    date,
    choreId,
    memberId,
    weightAtLog,
    createdAt: `${date}T00:00:00Z`,
  });

  // ============================================================================
  // F8-AC-1, F8-AC-2: getStreak
  // ============================================================================
  describe("getStreak", () => {
    it("counts 3 consecutive days including today", () => {
      const state = makeState({
        checkIns: [
          checkIn("2026-09-03", "m_me"),
          checkIn("2026-09-02", "m_me"),
          checkIn("2026-09-01", "m_me"),
        ],
      });
      expect(getStreak(state, "m_me", "2026-09-03")).toBe(3);
    });

    it("does not break the streak when today has no checkin yet", () => {
      const state = makeState({
        checkIns: [checkIn("2026-09-02", "m_me"), checkIn("2026-09-01", "m_me")],
      });
      expect(getStreak(state, "m_me", "2026-09-03")).toBe(2);
    });

    it("returns 0 when today and yesterday both have no checkin", () => {
      const state = makeState({ checkIns: [checkIn("2026-08-30", "m_me")] });
      expect(getStreak(state, "m_me", "2026-09-03")).toBe(0);
    });

    it("stops at the first gap and ignores older records before it", () => {
      const state = makeState({
        checkIns: [
          checkIn("2026-09-03", "m_me"),
          checkIn("2026-09-02", "m_me"),
          // gap: 2026-09-01
          checkIn("2026-08-31", "m_me"),
        ],
      });
      expect(getStreak(state, "m_me", "2026-09-03")).toBe(2);
    });

    it("only counts checkins for the requested member", () => {
      const state = makeState({
        checkIns: [checkIn("2026-09-03", "m_me"), checkIn("2026-09-02", "m_other1")],
      });
      expect(getStreak(state, "m_me", "2026-09-03")).toBe(1);
    });
  });

  // ============================================================================
  // F8-AC-3: getRanking
  // ============================================================================
  describe("getRanking", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("sorts by weightedScore desc within the given day window", () => {
      const state = makeState({
        checkIns: [
          checkIn("2026-09-01", "m_me", 2),
          checkIn("2026-09-02", "m_me", 2),
          checkIn("2026-09-01", "m_other1", 1),
          checkIn("2026-09-01", "m_other2", 1),
          checkIn("2026-09-02", "m_other2", 1),
          checkIn("2026-09-03", "m_other2", 3),
        ],
      });
      const result = getRanking(state, 30);
      expect(result[0]).toMatchObject({ memberId: "m_other2", weightedScore: 5 });
      expect(result[1]).toMatchObject({ memberId: "m_me", weightedScore: 4 });
      expect(result[2]).toMatchObject({ memberId: "m_other1", weightedScore: 1 });
    });

    it("breaks ties by memberName ascending", () => {
      const state = makeState({
        checkIns: [checkIn("2026-09-01", "m_other1", 2), checkIn("2026-09-01", "m_other2", 2)],
      });
      const result = getRanking(state, 30);
      const [alice, bob] = result.filter((r) => r.weightedScore === 2);
      expect(alice.memberName).toBe("Alice");
      expect(bob.memberName).toBe("Bob");
    });

    it("includes every member with sharePct 0 when there are no checkins", () => {
      const state = makeState({ checkIns: [] });
      const result = getRanking(state, 30);
      expect(result).toHaveLength(state.members.length);
      for (const r of result) {
        expect(r.weightedScore).toBe(0);
        expect(r.sharePct).toBe(0);
      }
    });
  });

  // ============================================================================
  // countTodayCheckIns
  // ============================================================================
  describe("countTodayCheckIns", () => {
    it("counts only today's checkins for the given member", () => {
      const state = makeState({
        checkIns: [
          checkIn("2026-09-03", "m_me"),
          checkIn("2026-09-03", "m_me", 1, "c2"),
          checkIn("2026-09-02", "m_me"),
          checkIn("2026-09-03", "m_other1"),
        ],
      });
      expect(countTodayCheckIns(state, "m_me", "2026-09-03")).toBe(2);
    });

    it("returns 0 when the member has no checkin today", () => {
      const state = makeState({ checkIns: [checkIn("2026-09-02", "m_me")] });
      expect(countTodayCheckIns(state, "m_me", "2026-09-03")).toBe(0);
    });
  });

  // ============================================================================
  // F8-AC-4, F8-AC-5: shouldShowReminder
  // ============================================================================
  describe("shouldShowReminder", () => {
    const settings = (overrides: Partial<Settings> = {}): Settings => ({
      reminderEnabled: true,
      reminderHour: 21,
      penaltyEnabled: true,
      lastReminderShownDate: null,
      ...overrides,
    });

    it("returns true once hour has passed, no checkin yet, not already shown today", () => {
      const now = new Date("2026-09-03T21:30:00Z");
      expect(shouldShowReminder(settings(), now, 0)).toBe(true);
    });

    it("returns false when reminderEnabled is false, regardless of time", () => {
      const now = new Date("2026-09-03T21:30:00Z");
      expect(shouldShowReminder(settings({ reminderEnabled: false }), now, 0)).toBe(false);
    });

    it("returns false when the member already checked in today", () => {
      const now = new Date("2026-09-03T21:30:00Z");
      expect(shouldShowReminder(settings(), now, 1)).toBe(false);
    });

    it("returns false before reminderHour", () => {
      const now = new Date("2026-09-03T20:59:00Z");
      expect(shouldShowReminder(settings(), now, 0)).toBe(false);
    });

    it("returns false when the reminder was already shown today", () => {
      const now = new Date("2026-09-03T21:30:00Z");
      expect(
        shouldShowReminder(settings({ lastReminderShownDate: "2026-09-03" }), now, 0)
      ).toBe(false);
    });
  });
});
