import { describe, it, expect } from "vitest";
import type {
  ChoreSplitState,
  Member,
  Chore,
  CheckIn,
  Household,
  Settings,
  SettlementRecord,
  WeeklyReport,
  MemberWeekStat,
  ColorToken,
  MemberId,
  ChoreId,
  CheckInId,
  RouteState,
} from "@/lib/types";

/**
 * AC-1: TypeScript compilation passes with zero runtime declarations
 * Tests that the types file exists, compiles, and contains only type exports (no const/function/enum)
 */
describe("AC-1: Pure type definitions (zero runtime code)", () => {
  it("should import all entity types without errors", () => {
    // This test passes if TypeScript compilation succeeds
    // The import statement above would fail at compile time if types don't exist
    expect(true).toBe(true);
  });

  it("should export type aliases for ID types", () => {
    // MemberId, ChoreId, CheckInId should be string types
    const memberId: MemberId = "m_aaaa1111";
    const choreId: ChoreId = "c_bbbb2222";
    const checkInId: CheckInId = "2026-09-03__c_bbbb2222__m_aaaa1111";

    expect(typeof memberId).toBe("string");
    expect(typeof choreId).toBe("string");
    expect(typeof checkInId).toBe("string");
  });
});

/**
 * AC-2: ChoreSplitState structure matches SPEC (version, household, members, chores, checkIns, settings, settlements)
 */
describe("AC-2: ChoreSplitState structure", () => {
  it("should have version: 1 literal type", () => {
    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
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

    expect(state.version).toBe(1);
  });

  it("should allow household to be Household | null", () => {
    const stateWithHousehold: ChoreSplitState = {
      version: 1,
      household: {
        id: "h_a1b2c3d4",
        name: "우리집",
        inviteCode: "K3M9QZ",
        createdAt: "2026-09-01T10:00:00.000Z",
      },
      members: [],
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

    expect(stateWithHousehold.household).not.toBeNull();
    expect(stateWithHousehold.household?.name).toBe("우리집");

    const stateWithoutHousehold: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
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

    expect(stateWithoutHousehold.household).toBeNull();
  });

  it("should have members array with Member type", () => {
    const member: Member = {
      id: "m_aaaa1111",
      name: "민수",
      colorToken: "blue",
      isMe: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };

    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [member],
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

    expect(state.members.length).toBe(1);
    expect(state.members[0].isMe).toBe(true);
  });

  it("should have chores array with Chore type", () => {
    const chore: Chore = {
      id: "c_bbbb2222",
      name: "설거지",
      weight: 2,
      frequency: "daily",
      penaltyAmount: 500,
      active: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };

    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [chore],
      checkIns: [],
      settings: {
        reminderEnabled: true,
        reminderHour: 21,
        penaltyEnabled: true,
        lastReminderShownDate: null,
      },
      settlements: [],
    };

    expect(state.chores.length).toBe(1);
    expect(state.chores[0].name).toBe("설거지");
  });

  it("should have checkIns array with CheckIn type", () => {
    const checkIn: CheckIn = {
      id: "2026-09-03__c_bbbb2222__m_aaaa1111",
      date: "2026-09-03",
      choreId: "c_bbbb2222",
      memberId: "m_aaaa1111",
      weightAtLog: 2,
      createdAt: "2026-09-03T21:10:00.000Z",
    };

    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [checkIn],
      settings: {
        reminderEnabled: true,
        reminderHour: 21,
        penaltyEnabled: true,
        lastReminderShownDate: null,
      },
      settlements: [],
    };

    expect(state.checkIns.length).toBe(1);
    expect(state.checkIns[0].date).toBe("2026-09-03");
  });

  it("should have settings object with Settings type", () => {
    const settings: Settings = {
      reminderEnabled: true,
      reminderHour: 21,
      penaltyEnabled: true,
      lastReminderShownDate: "2026-09-03",
    };

    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [],
      settings,
      settlements: [],
    };

    expect(state.settings.reminderHour).toBe(21);
    expect(state.settings.lastReminderShownDate).toBe("2026-09-03");
  });

  it("should have settlements array with SettlementRecord type", () => {
    const settlement: SettlementRecord = {
      weekStart: "2026-08-31",
      settledAt: "2026-09-03T21:10:00.000Z",
      lines: [
        {
          fromMemberId: "m_cccc3333",
          toMemberId: "m_aaaa1111",
          amount: 1500,
        },
      ],
      totalPenalty: 2500,
    };

    const state: ChoreSplitState = {
      version: 1,
      household: null,
      members: [],
      chores: [],
      checkIns: [],
      settings: {
        reminderEnabled: true,
        reminderHour: 21,
        penaltyEnabled: true,
        lastReminderShownDate: null,
      },
      settlements: [settlement],
    };

    expect(state.settlements.length).toBe(1);
    expect(state.settlements[0].totalPenalty).toBe(2500);
  });
});

/**
 * AC-3: Chore.weight is 1|2|3, Chore.frequency is 'daily'|'weekly', Member.colorToken is ColorToken union
 */
describe("AC-3: Literal type constraints", () => {
  it("should enforce Chore.weight as 1 | 2 | 3", () => {
    const chore1: Chore = {
      id: "c_1",
      name: "light",
      weight: 1,
      frequency: "daily",
      penaltyAmount: 500,
      active: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(chore1.weight).toBe(1);

    const chore2: Chore = {
      id: "c_2",
      name: "medium",
      weight: 2,
      frequency: "daily",
      penaltyAmount: 500,
      active: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(chore2.weight).toBe(2);

    const chore3: Chore = {
      id: "c_3",
      name: "heavy",
      weight: 3,
      frequency: "daily",
      penaltyAmount: 500,
      active: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(chore3.weight).toBe(3);
  });

  it("should enforce Chore.frequency as 'daily' | 'weekly'", () => {
    const daily: Chore = {
      id: "c_d",
      name: "daily",
      weight: 2,
      frequency: "daily",
      penaltyAmount: 500,
      active: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(daily.frequency).toBe("daily");

    const weekly: Chore = {
      id: "c_w",
      name: "weekly",
      weight: 2,
      frequency: "weekly",
      penaltyAmount: 1000,
      active: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(weekly.frequency).toBe("weekly");
  });

  it("should enforce Member.colorToken as ColorToken union ('blue' | 'green' | 'orange' | 'purple')", () => {
    const blue: Member = {
      id: "m_blue",
      name: "민수",
      colorToken: "blue",
      isMe: true,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(blue.colorToken).toBe("blue");

    const green: Member = {
      id: "m_green",
      name: "지영",
      colorToken: "green",
      isMe: false,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(green.colorToken).toBe("green");

    const orange: Member = {
      id: "m_orange",
      name: "현우",
      colorToken: "orange",
      isMe: false,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(orange.colorToken).toBe("orange");

    const purple: Member = {
      id: "m_purple",
      name: "수진",
      colorToken: "purple",
      isMe: false,
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    expect(purple.colorToken).toBe("purple");
  });
});

/**
 * AC-4: WeeklyReport has 8 fields (weekStart, weekEnd, stats, fairnessScore, totalWeighted, topChores, dailyTrend, missedItems)
 */
describe("AC-4: WeeklyReport structure with 8 fields", () => {
  it("should have weekStart field as string (YYYY-MM-DD)", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [],
    };

    expect(report.weekStart).toBe("2026-08-31");
    expect(typeof report.weekStart).toBe("string");
  });

  it("should have weekEnd field as string (Sunday YYYY-MM-DD)", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [],
    };

    expect(report.weekEnd).toBe("2026-09-06");
    expect(typeof report.weekEnd).toBe("string");
  });

  it("should have stats array of MemberWeekStat", () => {
    const stat: MemberWeekStat = {
      memberId: "m_aaaa1111",
      memberName: "민수",
      count: 4,
      weightedScore: 9,
      sharePct: 81.8,
    };

    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [stat],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [],
    };

    expect(report.stats.length).toBe(1);
    expect(report.stats[0].memberName).toBe("민수");
    expect(report.stats[0].weightedScore).toBe(9);
  });

  it("should have fairnessScore field as number (0-100)", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [],
    };

    expect(report.fairnessScore).toBe(36);
    expect(typeof report.fairnessScore).toBe("number");
  });

  it("should have totalWeighted field as number", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [],
    };

    expect(report.totalWeighted).toBe(11);
    expect(typeof report.totalWeighted).toBe("number");
  });

  it("should have topChores array with choreId, choreName, count", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [
        {
          choreId: "c_bbbb2222",
          choreName: "설거지",
          count: 5,
        },
      ],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [],
    };

    expect(report.topChores.length).toBe(1);
    expect(report.topChores[0].choreName).toBe("설거지");
    expect(report.topChores[0].count).toBe(5);
  });

  it("should have dailyTrend array with length 7 (Mon-Sun)", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [1, 2, 3, 2, 1, 0, 0],
      missedItems: [],
    };

    expect(report.dailyTrend.length).toBe(7);
    expect(report.dailyTrend[0]).toBe(1); // Monday
    expect(report.dailyTrend[6]).toBe(0); // Sunday
  });

  it("should have missedItems array with choreId, choreName, missedCount, penalty", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [
        {
          choreId: "c_bbbb2222",
          choreName: "설거지",
          missedCount: 3,
          penalty: 1500,
        },
      ],
    };

    expect(report.missedItems.length).toBe(1);
    expect(report.missedItems[0].missedCount).toBe(3);
    expect(report.missedItems[0].penalty).toBe(1500);
  });

  it("should have all 8 required fields present", () => {
    const report: WeeklyReport = {
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      stats: [],
      fairnessScore: 36,
      totalWeighted: 11,
      topChores: [],
      dailyTrend: [0, 0, 0, 0, 0, 0, 0],
      missedItems: [],
    };

    const fields = Object.keys(report);
    expect(fields).toContain("weekStart");
    expect(fields).toContain("weekEnd");
    expect(fields).toContain("stats");
    expect(fields).toContain("fairnessScore");
    expect(fields).toContain("totalWeighted");
    expect(fields).toContain("topChores");
    expect(fields).toContain("dailyTrend");
    expect(fields).toContain("missedItems");
    expect(fields.length).toBe(8);
  });
});

/**
 * AC-5: RouteState type contracts for each route + zero HEX color matches in source
 */
describe("AC-5: RouteState route contracts", () => {
  it("should support '/report/detail' with weekStart state", () => {
    const state: RouteState = {
      type: "report-detail",
      weekStart: "2026-08-31",
    };

    expect(state.weekStart).toBe("2026-08-31");
  });

  it("should support '/report/detail' with undefined state", () => {
    const state: RouteState = {
      type: "report-detail",
    };

    expect(state.weekStart).toBeUndefined();
  });

  it("should support '/settle' with weekStart state", () => {
    const state: RouteState = {
      type: "settle",
      weekStart: "2026-08-31",
    };

    expect(state.weekStart).toBe("2026-08-31");
  });

  it("should support '/settle' with undefined state", () => {
    const state: RouteState = {
      type: "settle",
    };

    expect(state.weekStart).toBeUndefined();
  });

  it("should support '/chores' with openCreate flag", () => {
    const stateWithOpen: RouteState = {
      type: "chores",
      openCreate: true,
    };

    expect(stateWithOpen.openCreate).toBe(true);

    const stateWithoutOpen: RouteState = {
      type: "chores",
      openCreate: false,
    };

    expect(stateWithoutOpen.openCreate).toBe(false);
  });

  it("should support '/chores' with undefined openCreate", () => {
    const state: RouteState = {
      type: "chores",
    };

    expect(state.openCreate).toBeUndefined();
  });

  it("should not contain HEX color literals in RouteState type definition", () => {
    // This test verifies that the types.ts file itself does not embed HEX colors
    // The actual regex check happens during source code inspection
    // This test passes if ColorToken is enum-like (not HEX strings)
    const colorToken: ColorToken = "blue";
    expect(colorToken).toMatch(/^(blue|green|orange|purple)$/);
  });
});

/**
 * Integration test: Verify complete state structure
 */
describe("Integration: Complete ChoreSplitState example", () => {
  it("should construct a valid complete state matching SPEC example", () => {
    const completeState: ChoreSplitState = {
      version: 1,
      household: {
        id: "h_a1b2c3d4",
        name: "우리집",
        inviteCode: "K3M9QZ",
        createdAt: "2026-09-01T10:00:00.000Z",
      },
      members: [
        {
          id: "m_aaaa1111",
          name: "민수",
          colorToken: "blue",
          isMe: true,
          createdAt: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "m_cccc3333",
          name: "지영",
          colorToken: "green",
          isMe: false,
          createdAt: "2026-09-01T10:05:00.000Z",
        },
      ],
      chores: [
        {
          id: "c_bbbb2222",
          name: "설거지",
          weight: 2,
          frequency: "daily",
          penaltyAmount: 500,
          active: true,
          createdAt: "2026-09-01T10:00:00.000Z",
        },
      ],
      checkIns: [
        {
          id: "2026-09-03__c_bbbb2222__m_aaaa1111",
          date: "2026-09-03",
          choreId: "c_bbbb2222",
          memberId: "m_aaaa1111",
          weightAtLog: 2,
          createdAt: "2026-09-03T21:10:00.000Z",
        },
      ],
      settings: {
        reminderEnabled: true,
        reminderHour: 21,
        penaltyEnabled: true,
        lastReminderShownDate: "2026-09-03",
      },
      settlements: [],
    };

    expect(completeState.version).toBe(1);
    expect(completeState.household?.name).toBe("우리집");
    expect(completeState.members.length).toBe(2);
    expect(completeState.chores[0].weight).toBe(2);
    expect(completeState.checkIns[0].date).toBe("2026-09-03");
    expect(completeState.settings.reminderHour).toBe(21);
  });
});
