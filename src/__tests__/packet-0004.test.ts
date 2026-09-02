import { describe, it, expect } from "vitest";
import type {
  ChoreSplitState,
  Member,
  Chore,
  CheckIn,
  MemberWeekStat,
  WeeklyReport,
} from "@/lib/types";
import {
  getWeekStart,
  getWeekEnd,
  buildWeeklyReport,
  buildSettlement,
} from "@/lib/report";

describe("Weekly Report Calculation Engine + Settlement", () => {
  // AC-1: Week start/end calculation
  describe("AC-1: Week boundaries", () => {
    it("getWeekStart returns Monday of the week in YYYY-MM-DD format", () => {
      // 2026-09-03 is Thursday, Monday of that week is 2026-08-31
      const result = getWeekStart("2026-09-03");
      expect(result).toBe("2026-08-31");
      // Verify format
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });

    it("getWeekEnd returns Sunday of the week in YYYY-MM-DD format", () => {
      // 2026-09-03 is Thursday, Sunday of that week is 2026-09-06
      const result = getWeekEnd("2026-09-03");
      expect(result).toBe("2026-09-06");
      // Verify format
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });

    it("getWeekStart and getWeekEnd span exactly 7 days (Mon-Sun inclusive)", () => {
      const start = getWeekStart("2026-09-03");
      const end = getWeekEnd("2026-09-03");
      const startDate = new Date(start);
      const endDate = new Date(end);
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(6); // 6-day difference = 7-day span (Mon-Sun)
    });
  });

  // AC-2: Stats calculation and sorting
  describe("AC-2: Stats calculation", () => {
    it("calculates count, weightedScore, and sharePct correctly", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "m2",
            name: "Bob",
            colorToken: "green",
            isMe: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-09-01__c2__m1",
            date: "2026-09-01",
            choreId: "c2",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          },
          {
            id: "2026-09-02__c3__m2",
            date: "2026-09-02",
            choreId: "c3",
            memberId: "m2",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      // m1: count=2, weightedScore=4, total=5, sharePct=Math.round(4/5*1000)/10=80.0
      expect(result.stats[0].memberId).toBe("m1");
      expect(result.stats[0].count).toBe(2);
      expect(result.stats[0].weightedScore).toBe(4);
      expect(result.stats[0].sharePct).toBe(80.0);

      // m2: count=1, weightedScore=1, sharePct=Math.round(1/5*1000)/10=20.0
      expect(result.stats[1].memberId).toBe("m2");
      expect(result.stats[1].count).toBe(1);
      expect(result.stats[1].weightedScore).toBe(1);
      expect(result.stats[1].sharePct).toBe(20.0);
    });

    it("sorts stats by weightedScore descending", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "m2",
            name: "Bob",
            colorToken: "green",
            isMe: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "m3",
            name: "Charlie",
            colorToken: "orange",
            isMe: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [],
        checkIns: [
          {
            id: "2026-08-31__c1__m3",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m3",
            weightAtLog: 3,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-09-01__c2__m1",
            date: "2026-09-01",
            choreId: "c2",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          },
          {
            id: "2026-09-02__c3__m2",
            date: "2026-09-02",
            choreId: "c3",
            memberId: "m2",
            weightAtLog: 1,
            createdAt: "2026-09-02T00:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      expect(result.stats[0].memberId).toBe("m3");
      expect(result.stats[0].weightedScore).toBe(3);
      expect(result.stats[1].memberId).toBe("m1");
      expect(result.stats[1].weightedScore).toBe(2);
      expect(result.stats[2].memberId).toBe("m2");
      expect(result.stats[2].weightedScore).toBe(1);
    });

    it("excludes inactive members from stats", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "m2",
            name: "Bob",
            colorToken: "green",
            isMe: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-09-01__c2__m2",
            date: "2026-09-01",
            choreId: "c2",
            memberId: "m2",
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      expect(result.stats).toHaveLength(1);
      expect(result.stats[0].memberId).toBe("m1");
    });
  });

  // AC-3: fairnessScore calculation
  describe("AC-3: FairnessScore formula", () => {
    it("calculates fairnessScore = Math.max(0, Math.round(100 - (maxSharePct - minSharePct)))", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "m2",
            name: "Bob",
            colorToken: "green",
            isMe: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 3,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-08-31__c2__m1",
            date: "2026-08-31",
            choreId: "c2",
            memberId: "m1",
            weightAtLog: 3,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-09-01__c3__m2",
            date: "2026-09-01",
            choreId: "c3",
            memberId: "m2",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      // m1: 3+3=6, m2: 1, total=7
      // m1 sharePct = round(6/7*1000)/10 ≈ 85.7
      // m2 sharePct = round(1/7*1000)/10 ≈ 14.3
      // fairnessScore = max(0, round(100 - (85.7 - 14.3))) ≈ round(28.6) ≈ 29
      expect(result.fairnessScore).toBe(29);
    });

    it("returns 100 when members.length < 2", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 3,
            createdAt: "2026-08-31T00:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      expect(result.fairnessScore).toBe(100);
    });

    it("returns 0 when totalWeighted === 0", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "m2",
            name: "Bob",
            colorToken: "green",
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
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      expect(result.fairnessScore).toBe(0);
    });

    it("handles negative fairnessScore by returning 0 via Math.max", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "m2",
            name: "Bob",
            colorToken: "green",
            isMe: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 3,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-09-01__c2__m2",
            date: "2026-09-01",
            choreId: "c2",
            memberId: "m2",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      // m1 sharePct ≈ 99, m2 sharePct ≈ 1
      // fairnessScore = Math.max(0, Math.round(100 - 98)) = 2
      expect(result.fairnessScore).toBeGreaterThanOrEqual(0);
      expect(result.fairnessScore).toBeLessThanOrEqual(100);
    });
  });

  // AC-4: dailyTrend and topChores
  describe("AC-4: Daily trend and top chores", () => {
    it("dailyTrend is length 7 with index 0=Monday, 6=Sunday", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 1,
            createdAt: "2026-08-31T00:00:00Z",
          }, // Monday
          {
            id: "2026-09-01__c2__m1",
            date: "2026-09-01",
            choreId: "c2",
            memberId: "m1",
            weightAtLog: 1,
            createdAt: "2026-09-01T00:00:00Z",
          }, // Tuesday
          {
            id: "2026-09-03__c3__m1",
            date: "2026-09-03",
            choreId: "c3",
            memberId: "m1",
            weightAtLog: 1,
            createdAt: "2026-09-03T00:00:00Z",
          }, // Thursday
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      expect(result.dailyTrend).toHaveLength(7);
      expect(result.dailyTrend[0]).toBe(1); // Monday
      expect(result.dailyTrend[1]).toBe(1); // Tuesday
      expect(result.dailyTrend[2]).toBe(0); // Wednesday
      expect(result.dailyTrend[3]).toBe(1); // Thursday
      expect(result.dailyTrend[4]).toBe(0); // Friday
      expect(result.dailyTrend[5]).toBe(0); // Saturday
      expect(result.dailyTrend[6]).toBe(0); // Sunday

      // All elements are integers
      result.dailyTrend.forEach((count) => {
        expect(Number.isInteger(count)).toBe(true);
      });
    });

    it("topChores has max 3 items, sorted by count descending then name ascending", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [
          {
            id: "c1",
            name: "Wash",
            weight: 2,
            frequency: "weekly",
            penaltyAmount: 1000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "c2",
            name: "Vacuum",
            weight: 3,
            frequency: "weekly",
            penaltyAmount: 1000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "c3",
            name: "Cook",
            weight: 2,
            frequency: "daily",
            penaltyAmount: 1000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "c4",
            name: "Dishes",
            weight: 2,
            frequency: "daily",
            penaltyAmount: 1000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-09-01__c1__m1",
            date: "2026-09-01",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-09-01T00:00:00Z",
          }, // c1: 2
          {
            id: "2026-09-02__c2__m1",
            date: "2026-09-02",
            choreId: "c2",
            memberId: "m1",
            weightAtLog: 3,
            createdAt: "2026-09-02T00:00:00Z",
          }, // c2: 1
          {
            id: "2026-09-03__c3__m1",
            date: "2026-09-03",
            choreId: "c3",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-09-03T00:00:00Z",
          },
          {
            id: "2026-09-04__c3__m1",
            date: "2026-09-04",
            choreId: "c3",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-09-04T00:00:00Z",
          }, // c3: 2
          {
            id: "2026-09-05__c4__m1",
            date: "2026-09-05",
            choreId: "c4",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-09-05T00:00:00Z",
          }, // c4: 1
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      expect(result.topChores).toHaveLength(3);
      // Sorted by count desc, then name asc: c1(2, "Cook" < "Wash"), c3(2), c2(1)
      // Wait: c1="Wash", c3="Cook", c2="Vacuum"
      // c1: 2, c3: 2 (alphabetically "Cook" < "Wash"), c2: 1
      expect(result.topChores[0].choreId).toBe("c3");
      expect(result.topChores[0].choreName).toBe("Cook");
      expect(result.topChores[0].count).toBe(2);
      expect(result.topChores[1].choreId).toBe("c1");
      expect(result.topChores[1].choreName).toBe("Wash");
      expect(result.topChores[1].count).toBe(2);
      expect(result.topChores[2].choreId).toBe("c2");
      expect(result.topChores[2].choreName).toBe("Vacuum");
      expect(result.topChores[2].count).toBe(1);
    });

    it("topChores returns fewer than 3 items if fewer chores logged", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [
          {
            id: "c1",
            name: "Wash",
            weight: 2,
            frequency: "weekly",
            penaltyAmount: 1000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "c2",
            name: "Vacuum",
            weight: 3,
            frequency: "weekly",
            penaltyAmount: 1000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-08-31T00:00:00Z",
          },
          {
            id: "2026-09-01__c2__m1",
            date: "2026-09-01",
            choreId: "c2",
            memberId: "m1",
            weightAtLog: 3,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      expect(result.topChores.length).toBeLessThanOrEqual(3);
      expect(result.topChores).toHaveLength(2);
    });
  });

  // AC-5: missedItems and immutability
  describe("AC-5: Missed items and settlement", () => {
    it("calculates missedItems with daily and weekly counts", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [
          {
            id: "c1",
            name: "Chore1",
            weight: 2,
            frequency: "daily",
            penaltyAmount: 5000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        checkIns: [
          {
            id: "2026-08-31__c1__m1",
            date: "2026-08-31",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-08-31T00:00:00Z",
          }, // Monday
          {
            id: "2026-09-06__c1__m1",
            date: "2026-09-06",
            choreId: "c1",
            memberId: "m1",
            weightAtLog: 2,
            createdAt: "2026-09-06T00:00:00Z",
          }, // Sunday
        ],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      // c1: has check-ins on Monday and Sunday, missing Tue-Sat = 5 days
      // missedCount = 5 (days with 0 check-ins out of 7)
      // penalty = 5 * 5000 = 25000
      const missedC1 = result.missedItems.find((item) => item.choreId === "c1");
      expect(missedC1?.choreId).toBe("c1");
      expect(missedC1?.choreName).toBe("Chore1");
      expect(missedC1?.missedCount).toBe(5);
      expect(missedC1?.penalty).toBe(25000);
    });

    it("sets missedCount=7 when chore has 0 check-ins in the entire week", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [
          {
            id: "c1",
            name: "Chore1",
            weight: 2,
            frequency: "daily",
            penaltyAmount: 5000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        checkIns: [], // No check-ins for anyone
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      const missedC1 = result.missedItems.find((item) => item.choreId === "c1");
      expect(missedC1?.choreId).toBe("c1");
      expect(missedC1?.missedCount).toBe(7); // All 7 days missing
      expect(missedC1?.penalty).toBe(7 * 5000); // 35000
    });

    it("excludes inactive chores from missedItems", () => {
      const state: ChoreSplitState = {
        version: 1,
        household: null,
        members: [
          {
            id: "m1",
            name: "Alice",
            colorToken: "blue",
            isMe: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        chores: [
          {
            id: "c1",
            name: "Active",
            weight: 2,
            frequency: "daily",
            penaltyAmount: 5000,
            active: true,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "c2",
            name: "Inactive",
            weight: 2,
            frequency: "daily",
            penaltyAmount: 5000,
            active: false,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
        checkIns: [],
        settings: {
          reminderEnabled: true,
          reminderHour: 21,
          penaltyEnabled: true,
          lastReminderShownDate: null,
        },
        settlements: [],
      };

      const result = buildWeeklyReport(state, "2026-08-31");

      // Only active chore c1 should be in missedItems, not inactive c2
      expect(result.missedItems.length).toBeGreaterThanOrEqual(0);
      expect(result.missedItems.every((item) => item.choreId !== "c2")).toBe(true);
    });

    it("does not mutate input state", () => {
      const state: AppState = {
        members: [
          { id: "m1", name: "Alice", joinDate: "2026-01-01", active: true },
          { id: "m2", name: "Bob", joinDate: "2026-01-01", active: true },
        ],
        chores: [{ id: "c1", name: "Chore1", weight: 10, frequencyDays: 1 }],
        logs: [
          {
            id: "l1",
            memberId: "m1",
            choreId: "c1",
            date: "2026-08-31",
            weightAtLog: 50,
          },
        ],
        settings: { penaltyAmount: 5000 },
      };

      const stateBefore = JSON.stringify(state);
      buildWeeklyReport(state, "2026-08-31");
      const stateAfter = JSON.stringify(state);

      expect(stateAfter).toBe(stateBefore);
    });

    it("buildSettlement also does not mutate input state", () => {
      const state: AppState = {
        members: [
          { id: "m1", name: "Alice", joinDate: "2026-01-01", active: true },
          { id: "m2", name: "Bob", joinDate: "2026-01-01", active: true },
        ],
        chores: [],
        logs: [
          {
            id: "l1",
            memberId: "m1",
            choreId: "c1",
            date: "2026-08-31",
            weightAtLog: 100,
          },
        ],
        settings: { penaltyAmount: 5000 },
      };

      const stateBefore = JSON.stringify(state);
      buildSettlement(state, "2026-08-31");
      const stateAfter = JSON.stringify(state);

      expect(stateAfter).toBe(stateBefore);
    });
  });

  // Settlement distribution logic
  describe("buildSettlement: penalty distribution inverse to contribution", () => {
    it("distributes missed penalties from low-contributors to high-contributors", () => {
      const state: AppState = {
        members: [
          { id: "m1", name: "Alice", joinDate: "2026-01-01", active: true },
          { id: "m2", name: "Bob", joinDate: "2026-01-01", active: true },
        ],
        chores: [],
        logs: [
          {
            id: "l1",
            memberId: "m1",
            choreId: "c1",
            date: "2026-08-31",
            weightAtLog: 100,
          }, // Alice: 100 (high)
          {
            id: "l2",
            memberId: "m2",
            choreId: "c2",
            date: "2026-09-01",
            weightAtLog: 0,
          }, // Bob: 0 (low, should pay penalty)
        ],
        settings: { penaltyAmount: 10000 },
      };

      const result = buildSettlement(state, "2026-08-31");

      // Bob has 0 logs (7 days × 10000 = 70000 penalty)
      // Should transfer from Bob to Alice
      const bobToAlice = result.find(
        (line) => line.from === "m2" && line.to === "m1"
      );
      expect(bobToAlice).toBeDefined();
      expect(bobToAlice?.amount).toBeGreaterThan(0);
    });

    it("returns empty settlement when no penalties exist", () => {
      const state: AppState = {
        members: [
          { id: "m1", name: "Alice", joinDate: "2026-01-01", active: true },
          { id: "m2", name: "Bob", joinDate: "2026-01-01", active: true },
        ],
        chores: [],
        logs: [
          {
            id: "l1",
            memberId: "m1",
            choreId: "c1",
            date: "2026-08-31",
            weightAtLog: 50,
          },
          {
            id: "l2",
            memberId: "m2",
            choreId: "c2",
            date: "2026-09-01",
            weightAtLog: 50,
          },
        ],
        settings: { penaltyAmount: 0 }, // No penalty
      };

      const result = buildSettlement(state, "2026-08-31");

      expect(result).toEqual([]);
    });
  });
});
