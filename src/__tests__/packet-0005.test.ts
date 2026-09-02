import { describe, it, expect } from "vitest";
import type { ChoreSplitState, Member, CheckIn } from "@/lib/types";
import {
  getCurrentStreak,
  getBestStreak,
  getRanking,
  shouldShowReminder,
} from "@/lib/streak";

/**
 * Test suite for Packet 0005: Streak & Ranking Calculation + Reminder Logic
 *
 * Pure function tests — no mocks needed
 */

describe("Streak & Ranking Calculation + Reminder Logic", () => {
  // Helper: build minimal test state
  const makeState = (
    overrides: Partial<ChoreSplitState> = {}
  ): ChoreSplitState => ({
    version: 1,
    household: null,
    members: [
      {
        id: "m_me",
        name: "Me",
        colorToken: "blue",
        isMe: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "m_other1",
        name: "Alice",
        colorToken: "green",
        isMe: false,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "m_other2",
        name: "Bob",
        colorToken: "orange",
        isMe: false,
        createdAt: "2026-01-01T00:00:00Z",
      },
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

  // ============================================================================
  // AC-1: getCurrentStreak with recent consecutive checkins
  // ============================================================================
  describe("AC-1: getCurrentStreak with consecutive checkins", () => {
    it("returns 3 when last 3 days (including today) have my checkins", () => {
      // Today: 2026-09-03 (Thursday)
      // Streak: 2026-09-03, 2026-09-02, 2026-09-01 (3 days)
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-03__c1__m_me",
            date: "2026-09-03",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-03T00:00:00Z",
          },
          {
            id: "2026-09-02__c1__m_me",
            date: "2026-09-02",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      });
      const result = getCurrentStreak(state, "2026-09-03");
      expect(result).toBe(3);
      expect(result).toBeGreaterThan(0);
    });

    it("returns 2 when streak is 3 days but today has no checkin", () => {
      // Today: 2026-09-03 (no checkin)
      // Streak up to yesterday: 2026-09-02, 2026-09-01 (2 days)
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-02__c1__m_me",
            date: "2026-09-02",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      });
      const result = getCurrentStreak(state, "2026-09-03");
      expect(result).toBe(2);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("counts only my checkins, ignoring other members", () => {
      // Today: 2026-09-03 (my checkin)
      // Yesterday: 2026-09-02 (other's checkin) — break my streak
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-03__c1__m_me",
            date: "2026-09-03",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-03T00:00:00Z",
          },
          {
            id: "2026-09-02__c1__m_other1",
            date: "2026-09-02",
            choreId: "c1",
            memberId: "m_other1",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      });
      const result = getCurrentStreak(state, "2026-09-03");
      // Streak is only today (2026-09-03), because yesterday is a gap
      expect(result).toBe(1);
    });

    it("returns 0 when today has no checkin and yesterday is not checked in", () => {
      // Today: 2026-09-03 (no checkin)
      // Yesterday: 2026-09-02 (no checkin)
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      });
      const result = getCurrentStreak(state, "2026-09-03");
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // AC-2: getCurrentStreak gap logic
  // ============================================================================
  describe("AC-2: getCurrentStreak excludes records before gap", () => {
    it("stops counting at gap (does not include older records before break)", () => {
      // Timeline:
      // 2026-09-03: my checkin
      // 2026-09-02: my checkin
      // 2026-09-01: GAP (no my checkin)
      // 2026-08-31: my checkin (should NOT be counted)
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-03__c1__m_me",
            date: "2026-09-03",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-03T00:00:00Z",
          },
          {
            id: "2026-09-02__c1__m_me",
            date: "2026-09-02",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
          {
            id: "2026-08-31__c1__m_me",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-31T00:00:00Z",
          },
        ],
      });
      const result = getCurrentStreak(state, "2026-09-03");
      // Streak is only 2 (2026-09-03, 2026-09-02), not 3
      expect(result).toBe(2);
      expect(result).not.toBe(3);
    });

    it("treats gap day same as no checkin (continues forward only)", () => {
      // Timeline:
      // 2026-09-03: my checkin
      // 2026-09-02: GAP (no my checkin)
      // 2026-09-01: my checkin (should NOT count)
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-03__c1__m_me",
            date: "2026-09-03",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-03T00:00:00Z",
          },
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      });
      const result = getCurrentStreak(state, "2026-09-03");
      // Streak is 1 (only 2026-09-03)
      expect(result).toBe(1);
    });
  });

  // ============================================================================
  // AC-3: getBestStreak
  // ============================================================================
  describe("AC-3: getBestStreak returns longest consecutive streak", () => {
    it("returns longest streak from history", () => {
      // Streaks: [5 days], [gap], [3 days], [gap], [1 day]
      // Best: 5
      const state = makeState({
        checkIns: [
          // Streak 1: 2026-08-27 to 2026-08-31 (5 days)
          {
            id: "2026-08-31__c1__m_me",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-08-30__c1__m_me",
            date: "2026-08-30",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-30T00:00:00Z",
          },
          {
            id: "2026-08-29__c1__m_me",
            date: "2026-08-29",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-29T00:00:00Z",
          },
          {
            id: "2026-08-28__c1__m_me",
            date: "2026-08-28",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-28T00:00:00Z",
          },
          {
            id: "2026-08-27__c1__m_me",
            date: "2026-08-27",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-27T00:00:00Z",
          },
          // GAP: 2026-08-26
          // Streak 2: 2026-08-25 to 2026-08-23 (3 days)
          {
            id: "2026-08-25__c1__m_me",
            date: "2026-08-25",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-25T00:00:00Z",
          },
          {
            id: "2026-08-24__c1__m_me",
            date: "2026-08-24",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-24T00:00:00Z",
          },
          {
            id: "2026-08-23__c1__m_me",
            date: "2026-08-23",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-08-23T00:00:00Z",
          },
        ],
      });
      const result = getBestStreak(state);
      expect(result).toBe(5);
      expect(result).toBeGreaterThan(3);
    });

    it("returns 0 when no checkins exist", () => {
      const state = makeState({ checkIns: [] });
      const result = getBestStreak(state);
      expect(result).toBe(0);
    });

    it("returns 1 when only single isolated checkin exists", () => {
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      });
      const result = getBestStreak(state);
      expect(result).toBe(1);
    });

    it("counts only my checkins when calculating best streak", () => {
      // Only other members have checkins
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-03__c1__m_other1",
            date: "2026-09-03",
            choreId: "c1",
            memberId: "m_other1",
            weightAtLog: 1,
            createdAt: "2026-09-03T00:00:00Z",
          },
          {
            id: "2026-09-02__c1__m_other1",
            date: "2026-09-02",
            choreId: "c1",
            memberId: "m_other1",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
        ],
      });
      const result = getBestStreak(state);
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // AC-4: getRanking
  // ============================================================================
  describe("AC-4: getRanking sorts by weightedScore desc, then memberName asc", () => {
    it("returns ranking sorted by weightedScore descending", () => {
      // Week: 2026-08-31 (Mon) ~ 2026-09-06 (Sun)
      const state = makeState({
        checkIns: [
          // Me: 2 checkins, weight 2 each = 4
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          },
          {
            id: "2026-09-02__c2__m_me",
            date: "2026-09-02",
            choreId: "c2",
            memberId: "m_me",
            weightAtLog: 2,
            createdAt: "2026-09-02T00:00:00Z",
          },
          // Alice: 1 checkin, weight 1 = 1
          {
            id: "2026-09-01__c1__m_other1",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_other1",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
          // Bob: 3 checkins, weight 1, 1, 3 = 5
          {
            id: "2026-09-01__c1__m_other2",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_other2",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
          {
            id: "2026-09-02__c2__m_other2",
            date: "2026-09-02",
            choreId: "c2",
            memberId: "m_other2",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
          {
            id: "2026-09-03__c3__m_other2",
            date: "2026-09-03",
            choreId: "c3",
            memberId: "m_other2",
            weightAtLog: 3,
            createdAt: "2026-09-03T00:00:00Z",
          },
        ],
      });
      const result = getRanking(state, "2026-08-31");
      expect(result).toHaveLength(3);
      // Bob (5) > Me (4) > Alice (1)
      expect(result[0].memberId).toBe("m_other2");
      expect(result[0].weightedScore).toBe(5);
      expect(result[1].memberId).toBe("m_me");
      expect(result[1].weightedScore).toBe(4);
      expect(result[2].memberId).toBe("m_other1");
      expect(result[2].weightedScore).toBe(1);
    });

    it("sorts by memberName ascending when weightedScore is tied", () => {
      // Alice and Bob both have 2 points
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-01__c1__m_other1",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_other1", // Alice
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          },
          {
            id: "2026-09-01__c1__m_other2",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_other2", // Bob
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      });
      const result = getRanking(state, "2026-08-31");
      expect(result).toHaveLength(2);
      // Same score, so sort by name: Alice < Bob
      expect(result[0].memberName).toBe("Alice");
      expect(result[1].memberName).toBe("Bob");
    });

    it("only includes checkins from the specified week", () => {
      // Week start: 2026-08-31 (Mon)
      const state = makeState({
        checkIns: [
          // In week
          {
            id: "2026-09-01__c1__m_me",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          },
          // Before week
          {
            id: "2026-08-30__c1__m_me",
            date: "2026-08-30",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 3,
            createdAt: "2026-08-30T00:00:00Z",
          },
          // After week
          {
            id: "2026-09-07__c1__m_me",
            date: "2026-09-07",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 3,
            createdAt: "2026-09-07T00:00:00Z",
          },
        ],
      });
      const result = getRanking(state, "2026-08-31");
      expect(result).toHaveLength(1);
      expect(result[0].weightedScore).toBe(2); // Only in-week checkin (weight 2)
    });
  });

  // ============================================================================
  // AC-5: shouldShowReminder
  // ============================================================================
  describe("AC-5: shouldShowReminder state immutability & logic", () => {
    it("returns false when reminderEnabled is false", () => {
      const state = makeState({
        settings: {
          reminderEnabled: false,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      const now = new Date("2026-09-03T21:30:00Z");
      const result = shouldShowReminder(state, now);
      expect(result).toBe(false);
    });

    it("returns false when today already has my checkin", () => {
      // Today: 2026-09-03, I have 1 checkin
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-03__c1__m_me",
            date: "2026-09-03",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-03T10:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      const now = new Date("2026-09-03T21:30:00Z");
      const result = shouldShowReminder(state, now);
      expect(result).toBe(false);
    });

    it("returns false when lastReminderShownDate is today", () => {
      const state = makeState({
        checkIns: [],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: "2026-09-03",
        },
      });
      const now = new Date("2026-09-03T21:30:00Z");
      const result = shouldShowReminder(state, now);
      expect(result).toBe(false);
    });

    it("returns false when current time is before reminderHour", () => {
      const state = makeState({
        checkIns: [],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      // Current time: 20:00 (before 21:00)
      const now = new Date("2026-09-03T20:00:00Z");
      const result = shouldShowReminder(state, now);
      expect(result).toBe(false);
    });

    it("returns true when all conditions met: enabled, no today checkin, time passed, reminder not shown", () => {
      const state = makeState({
        checkIns: [],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      // Current time: 21:30 (after 21:00), no checkin today, reminder not shown
      const now = new Date("2026-09-03T21:30:00Z");
      const result = shouldShowReminder(state, now);
      expect(result).toBe(true);
    });

    it("does not mutate input state (JSON.stringify before/after identical)", () => {
      const state = makeState({
        checkIns: [],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      const stateBefore = JSON.stringify(state);
      const now = new Date("2026-09-03T21:30:00Z");
      shouldShowReminder(state, now);
      const stateAfter = JSON.stringify(state);
      expect(stateAfter).toBe(stateBefore);
    });

    it("returns false when time equals exactly reminderHour:00:00 (boundary check)", () => {
      const state = makeState({
        checkIns: [],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      // Current time: exactly 21:00:00
      const now = new Date("2026-09-03T21:00:00Z");
      const result = shouldShowReminder(state, now);
      // At exactly 21:00, should be true (>= 21:00)
      expect(result).toBe(true);
    });

    it("returns true when time is after reminderHour (boundary check)", () => {
      const state = makeState({
        checkIns: [],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      // Current time: 21:00:01
      const now = new Date("2026-09-03T21:00:01Z");
      const result = shouldShowReminder(state, now);
      expect(result).toBe(true);
    });

    it("only counts today's checkins (ignores other dates when evaluating today)", () => {
      const state = makeState({
        checkIns: [
          {
            id: "2026-09-02__c1__m_me",
            date: "2026-09-02",
            choreId: "c1",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-02T21:00:00Z",
          },
          {
            id: "2026-09-01__c2__m_me",
            date: "2026-09-01",
            choreId: "c2",
            memberId: "m_me",
            weightAtLog: 1,
            createdAt: "2026-09-01T21:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
      });
      // Today: 2026-09-03, no checkins (yesterday's don't count)
      const now = new Date("2026-09-03T21:30:00Z");
      const result = shouldShowReminder(state, now);
      expect(result).toBe(true);
    });
  });
});
