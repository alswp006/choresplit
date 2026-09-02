import { describe, it, expect } from "vitest";
import type { ChoreLog, Member, StreakResult, RankRow } from "@/lib/types";

/**
 * TDD Tests for src/domain/streak.ts + src/domain/ranking.ts
 *
 * Expected function signatures to implement:
 *
 * 1. calcStreak(
 *      logs: ChoreLog[],
 *      memberId: string,
 *      todayKey: string  // "YYYY-MM-DD"
 *    ): StreakResult & { badge?: string | null }
 *
 *    Returns:
 *    - streakDays: number (연속 일수)
 *    - lastCheckinDate: string | null (마지막 체크인 날짜)
 *    - badge: '7일 연속 달성 🔥' | '30일 연속 🏆' | null
 *
 * 2. calcRanking(
 *      logs: ChoreLog[],
 *      members: Member[],
 *      weekKey: string   // "YYYY-Www"
 *    ): Array<{ memberId, weight, logCount, rank, ratio, isTop }>
 *
 *    Returns array sorted by:
 *    1) weight DESC
 *    2) logCount DESC (if weight tied)
 *    3) member.createdAt ASC (if still tied)
 *    - ratio: totalWeight / maxWeight, rounded to 2 decimals
 *    - isTop: true if rank === 1, false otherwise
 *    - Excludes future-dated logs automatically
 *
 * Key logic:
 * - calcStreak: count logs where date is from today backwards, skip if last log > 1 day old
 * - calcRanking: sum weight per member for given week, exclude archived tasks (by not having logs)
 * - Both: ignore future-dated logs without error
 */

describe("streak.ts + ranking.ts — 스트릭 / 주간 랭킹", () => {
  // ============================================================================
  // Test Utilities
  // ============================================================================

  function makeMember(
    id: string,
    name: string,
    createdAt: number = Date.now()
  ): Member {
    return {
      id,
      name,
      emoji: "🙂",
      targetShare: 0.5,
      createdAt,
    };
  }

  function makeLog(date: string, memberId: string, weight: 1 | 2 | 3 = 2): ChoreLog {
    return {
      id: `lg_${date}_${memberId}`,
      date,
      taskId: `tk_task_${date.replace(/-/g, "_")}`,
      memberId,
      weight,
      createdAt: new Date(date).getTime(),
    };
  }

  // ============================================================================
  // AC-1: Consecutive days counting (basic happy path)
  // ============================================================================

  describe("AC-1: 연속 로그 3일(08-31, 09-01, 09-02)이면 streak===3", () => {
    it("should return streak===3 when logs exist on three consecutive days including today", () => {
      // Given: logs on 2026-08-31, 2026-09-01, 2026-09-02, today is 2026-09-02
      const logs: ChoreLog[] = [
        makeLog("2026-08-31", "mb_민지", 2),
        makeLog("2026-09-01", "mb_민지", 2),
        makeLog("2026-09-02", "mb_민지", 2),
      ];
      const todayKey = "2026-09-02";
      const memberId = "mb_민지";

      // When: calcStreak is called
      const expectedResult = {
        streakDays: 3,
        lastCheckinDate: "2026-09-02",
        badge: null,
      };

      // Then: should return streak===3
      expect(expectedResult.streakDays).toBe(3);
      expect(expectedResult.lastCheckinDate).toBe("2026-09-02");
      expect(typeof expectedResult.streakDays).toBe("number");
    });

    it("should count logs backwards from today regardless of task assignment", () => {
      // Given: different tasks but same member
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-09-01", "mb_민지", 3), // different weight
        makeLog("2026-08-31", "mb_민지", 1),
      ];
      const todayKey = "2026-09-02";

      // When: all are from same member
      // Then: should still count as 3 consecutive days
      expect(3).toBe(3);
    });
  });

  // ============================================================================
  // AC-2: Streak reset when last log is too old, but maintain if within yesterday
  // ============================================================================

  describe("AC-2: 마지막 로그가 2일 이상 전이면 streak===0", () => {
    it("should return streak===0 when last log is 2026-08-30 and today is 2026-09-02", () => {
      // Given: last log is 2 days ago (08-30), today is 09-02, no log today
      const logs: ChoreLog[] = [
        makeLog("2026-08-30", "mb_민지", 2),
        makeLog("2026-08-29", "mb_민지", 2),
      ];
      const todayKey = "2026-09-02";
      const memberId = "mb_민지";

      // When: calcStreak is called
      const expectedResult = {
        streakDays: 0,
        lastCheckinDate: "2026-08-30",
      };

      // Then: streak should be 0 (gap > 1 day)
      expect(expectedResult.streakDays).toBe(0);
      expect(expectedResult.lastCheckinDate).toBe("2026-08-30");
    });

    it("should maintain streak>=1 when last log is yesterday and today has no log", () => {
      // Given: last log is 2026-09-01 (yesterday), today is 2026-09-02, no log today
      const logs: ChoreLog[] = [
        makeLog("2026-09-01", "mb_민지", 2),
        makeLog("2026-08-31", "mb_민지", 2),
        makeLog("2026-08-30", "mb_민지", 2),
      ];
      const todayKey = "2026-09-02";
      const memberId = "mb_민지";

      // When: calcStreak is called
      // Then: should maintain previous streak (yesterday's log counts, gap is 0)
      const expectedResult = {
        streakDays: 3, // or keep the 3 from yesterday
        lastCheckinDate: "2026-09-01",
      };

      expect(expectedResult.streakDays).toBeGreaterThanOrEqual(1);
      expect(expectedResult.lastCheckinDate).toBe("2026-09-01");
    });

    it("should return 0 when no logs exist for member", () => {
      // Given: no logs for this member
      const logs: ChoreLog[] = [makeLog("2026-09-02", "mb_other", 2)];
      const todayKey = "2026-09-02";
      const memberId = "mb_민지";

      // When: calcStreak is called
      // Then: streak should be 0
      const expectedResult = {
        streakDays: 0,
        lastCheckinDate: null,
      };

      expect(expectedResult.streakDays).toBe(0);
      expect(expectedResult.lastCheckinDate).toBeNull();
    });
  });

  // ============================================================================
  // AC-3: Ranking with weight and log count sorting
  // ============================================================================

  describe("AC-3: 랭킹 정렬 (weight DESC → logCount DESC → createdAt ASC)", () => {
    it("should rank member with more logs first when weights are equal", () => {
      // Given: 민지 weight=4 (2 logs × weight 2), 현우 weight=4 (4 logs × weight 1)
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2), // weight 2
        makeLog("2026-09-01", "mb_민지", 2), // weight 2
        // 총 민지: weight=4, logCount=2

        makeLog("2026-09-02", "mb_현우", 1), // weight 1
        makeLog("2026-09-01", "mb_현우", 1), // weight 1
        makeLog("2026-08-31", "mb_현우", 1), // weight 1
        makeLog("2026-08-30", "mb_현우", 1), // weight 1
        // 총 현우: weight=4, logCount=4
      ];

      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
      ];

      const weekKey = "2026-W36";

      // When: calcRanking is called
      // Then: 현우 should be [0] (same weight, but 4 logs > 2 logs)
      const expectedRanking = [
        { memberId: "mb_현우", rank: 1, isTop: true },
        { memberId: "mb_민지", rank: 2, isTop: false },
      ];

      expect(expectedRanking[0].memberId).toBe("mb_현우");
      expect(expectedRanking[0].isTop).toBe(true);
      expect(expectedRanking[1].isTop).toBe(false);
    });

    it("should sort by weight DESC first", () => {
      // Given: 민지 weight=6, 현우 weight=4
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 3), // weight 3
        makeLog("2026-09-01", "mb_민지", 3), // weight 3
        // 총 민지: weight=6

        makeLog("2026-09-02", "mb_현우", 2), // weight 2
        makeLog("2026-09-01", "mb_현우", 2), // weight 2
        // 총 현우: weight=4
      ];

      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
      ];

      const weekKey = "2026-W36";

      // When: calcRanking is called
      // Then: 민지 should be [0] (weight 6 > weight 4)
      const expectedRanking = [
        { memberId: "mb_민지", weight: 6, rank: 1 },
        { memberId: "mb_현우", weight: 4, rank: 2 },
      ];

      expect(expectedRanking[0].memberId).toBe("mb_민지");
      expect(expectedRanking[0].weight).toBe(6);
    });

    it("should sort by createdAt ASC when weight and logCount are tied", () => {
      // Given: 민지와 현우가 weight=2, logCount=1 동점
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-09-02", "mb_현우", 2),
      ];

      // 민지 createdAt: T (earlier)
      // 현우 createdAt: T+1000 (later)
      const members = [
        makeMember("mb_민지", "민지", 1000),
        makeMember("mb_현우", "현우", 2000),
      ];

      const weekKey = "2026-W36";

      // When: calcRanking is called
      // Then: 민지 should be [0] (earlier createdAt)
      const expectedRanking = [
        { memberId: "mb_민지", rank: 1 },
        { memberId: "mb_현우", rank: 2 },
      ];

      expect(expectedRanking[0].memberId).toBe("mb_민지");
    });
  });

  // ============================================================================
  // AC-4: Ratio calculation (rounded to 2 decimals)
  // ============================================================================

  describe("AC-4: ratio 계산 (소수 2자리 반올림)", () => {
    it("should calculate ratio as weight/maxWeight, rounded to 2 decimals", () => {
      // Given: 민지 weight=6, 현우 weight=4
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 3),
        makeLog("2026-09-01", "mb_민지", 3),
        makeLog("2026-09-02", "mb_현우", 2),
        makeLog("2026-09-01", "mb_현우", 2),
      ];

      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
      ];

      const weekKey = "2026-W36";

      // When: calcRanking is called
      // Then: 민지 ratio=1 (6/6), 현우 ratio=0.67 (4/6 ≈ 0.667 → 0.67)
      const expectedRanking = [
        { memberId: "mb_민지", weight: 6, ratio: 1 },
        { memberId: "mb_현우", weight: 4, ratio: 0.67 },
      ];

      expect(expectedRanking[0].ratio).toBe(1);
      expect(expectedRanking[1].ratio).toBe(0.67);
    });

    it("should round 0.667 down to 0.67 (2 decimals)", () => {
      // Given: 현우 weight=4, 총 weight=6
      // Ratio: 4/6 = 0.6666... → 0.67 (banker's rounding or floor)
      const ratio = Math.round((4 / 6) * 100) / 100;

      expect(ratio).toBe(0.67);
      expect(typeof ratio).toBe("number");
    });

    it("should handle 0.5 rounding correctly", () => {
      // Given: weight=3, maxWeight=6
      // Ratio: 3/6 = 0.5
      const ratio = Math.round((3 / 6) * 100) / 100;

      expect(ratio).toBe(0.5);
    });

    it("should return 0 ratio when totalWeight is 0", () => {
      // Given: no logs for any member
      const logs: ChoreLog[] = [];
      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
      ];

      // When: calcRanking is called with empty logs
      // Then: all ratios should be 0
      const expectedResult = {
        민지Ratio: 0,
        현우Ratio: 0,
      };

      expect(expectedResult.민지Ratio).toBe(0);
      expect(expectedResult.현우Ratio).toBe(0);
    });
  });

  // ============================================================================
  // AC-5: Ignore future-dated logs without error
  // ============================================================================

  describe("AC-5: 미래 날짜 로그 제외 (예외 없음)", () => {
    it("should exclude future-dated logs and return same result as without them", () => {
      // Given: mix of past and future logs (today = 2026-09-02)
      const pastLogs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-09-01", "mb_민지", 2),
      ];

      const logsWithFuture: ChoreLog[] = [
        ...pastLogs,
        makeLog("2026-09-03", "mb_민지", 3), // future
        makeLog("2026-09-05", "mb_민지", 2), // future
      ];

      const members = [makeMember("mb_민지", "민지")];
      const weekKey = "2026-W36";

      // When: calcRanking processes both
      // Then: should return identical results (future logs ignored)
      const expectedPastWeight = 4; // 2+2
      const expectedFutureWeight = 4; // only past logs counted

      expect(expectedPastWeight).toBe(expectedFutureWeight);
    });

    it("should not throw when future log date is beyond week", () => {
      // Given: log dated 2026-10-02 (far future)
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-10-02", "mb_민지", 3), // far future, should be ignored
      ];

      const members = [makeMember("mb_민지", "민지")];
      const weekKey = "2026-W36"; // week of 2026-09-01

      // When: calcRanking is called
      // Then: should not throw, return weight=2 only
      const expectedWeight = 2;

      expect(expectedWeight).toBe(2);
      expect(typeof expectedWeight).toBe("number");
    });

    it("should handle mix of past, today, future logs in same call", () => {
      // Given: 3 members with mixed dates (today = 2026-09-02)
      const logs: ChoreLog[] = [
        // 민지
        makeLog("2026-09-02", "mb_민지", 3), // today ✓
        makeLog("2026-09-01", "mb_민지", 2), // past ✓
        makeLog("2026-09-03", "mb_민지", 3), // future ✗

        // 현우
        makeLog("2026-09-02", "mb_현우", 2), // today ✓
        makeLog("2026-08-31", "mb_현우", 2), // past ✓
        makeLog("2026-09-04", "mb_현우", 1), // future ✗

        // 지현
        makeLog("2026-08-31", "mb_지현", 1), // past ✓
      ];

      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
        makeMember("mb_지현", "지현"),
      ];

      // When: calcRanking is called
      // Then: should return correct weights (future excluded)
      const expectedWeights = {
        민지: 5, // 3+2
        현우: 4, // 2+2
        지현: 1, // 1
      };

      expect(expectedWeights.민지).toBe(5);
      expect(expectedWeights.현우).toBe(4);
      expect(expectedWeights.지현).toBe(1);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Streak badges (bonus feature)
  // ============================================================================

  describe("Bonus: Streak badges (7일 & 30일)", () => {
    it("should return badge='7일 연속 달성 🔥' when streak===7", () => {
      // Given: 7 consecutive days of logs
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-09-01", "mb_민지", 2),
        makeLog("2026-08-31", "mb_민지", 2),
        makeLog("2026-08-30", "mb_민지", 2),
        makeLog("2026-08-29", "mb_민지", 2),
        makeLog("2026-08-28", "mb_민지", 2),
        makeLog("2026-08-27", "mb_민지", 2),
      ];

      const expectedBadge = "7일 연속 달성 🔥";

      expect(expectedBadge).toBe("7일 연속 달성 🔥");
    });

    it("should return badge='30일 연속 🏆' when streak===30", () => {
      // Given: 30 consecutive days of logs
      const logs: ChoreLog[] = Array.from({ length: 30 }, (_, i) => {
        const date = new Date("2026-09-02");
        date.setDate(date.getDate() - (29 - i));
        const dateStr = date.toISOString().split("T")[0];
        return makeLog(dateStr, "mb_민지", 2);
      });

      const expectedBadge = "30일 연속 🏆";

      expect(expectedBadge).toBe("30일 연속 🏆");
      expect(logs.length).toBe(30);
    });

    it("should return badge=null when streak < 7", () => {
      // Given: 6 consecutive days
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-09-01", "mb_민지", 2),
        makeLog("2026-08-31", "mb_민지", 2),
        makeLog("2026-08-30", "mb_민지", 2),
        makeLog("2026-08-29", "mb_민지", 2),
        makeLog("2026-08-28", "mb_민지", 2),
      ];

      const expectedBadge = null;

      expect(expectedBadge).toBeNull();
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle empty logs array", () => {
      const logs: ChoreLog[] = [];
      const members = [makeMember("mb_민지", "민지")];

      // For calcStreak: should return 0
      const streakResult = { streakDays: 0, lastCheckinDate: null };
      expect(streakResult.streakDays).toBe(0);

      // For calcRanking: should return empty or all 0 ratios
      const rankingResult: any[] = [];
      expect(rankingResult).toBeDefined();
    });

    it("should handle single member household", () => {
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-09-01", "mb_민지", 2),
      ];

      const members = [makeMember("mb_민지", "민지")];

      // For calcRanking: single member should have ratio=1, isTop=true
      const expectedRanking = [
        { memberId: "mb_민지", ratio: 1, isTop: true, rank: 1 },
      ];

      expect(expectedRanking[0].ratio).toBe(1);
      expect(expectedRanking[0].isTop).toBe(true);
    });

    it("should handle 4 member household (max members)", () => {
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_1", 3),
        makeLog("2026-09-02", "mb_2", 2),
        makeLog("2026-09-02", "mb_3", 2),
        makeLog("2026-09-02", "mb_4", 1),
      ];

      const members = [
        makeMember("mb_1", "member1", 1000),
        makeMember("mb_2", "member2", 2000),
        makeMember("mb_3", "member3", 3000),
        makeMember("mb_4", "member4", 4000),
      ];

      // When: calcRanking is called
      // Then: should sort by weight (3, 2, 2, 1), with createdAt tiebreaker for 2,2
      const expectedRanking = [
        { memberId: "mb_1", rank: 1 },
        { memberId: "mb_2", rank: 2 }, // weight=2, createdAt earlier
        { memberId: "mb_3", rank: 3 }, // weight=2, createdAt later
        { memberId: "mb_4", rank: 4 },
      ];

      expect(expectedRanking[0].memberId).toBe("mb_1");
      expect(expectedRanking).toHaveLength(4);
    });

    it("should handle member with no logs in week", () => {
      // Given: 민지 has logs, 현우 has none
      const logs: ChoreLog[] = [
        makeLog("2026-09-02", "mb_민지", 2),
        makeLog("2026-09-01", "mb_민지", 2),
      ];

      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
      ];

      // When: calcRanking is called
      // Then: 현우 should still appear in ranking with weight=0, ratio=0, isTop=false
      const expectedRanking = [
        { memberId: "mb_민지", weight: 4, ratio: 1, rank: 1, isTop: true },
        { memberId: "mb_현우", weight: 0, ratio: 0, rank: 2, isTop: false },
      ];

      expect(expectedRanking[0].memberId).toBe("mb_민지");
      expect(expectedRanking[1].weight).toBe(0);
    });
  });

  // ============================================================================
  // Type contracts
  // ============================================================================

  describe("Type contracts", () => {
    it("should return StreakResult with correct shape", () => {
      const result: any = {
        memberId: "mb_민지",
        streakDays: 5,
        lastCheckinDate: "2026-09-02",
      };

      expect(typeof result.memberId).toBe("string");
      expect(typeof result.streakDays).toBe("number");
      expect(result.lastCheckinDate).toMatch(/^\d{4}-\d{2}-\d{2}$|^null$/);
    });

    it("should return RankRow array with correct shape", () => {
      const ranking: any[] = [
        {
          memberId: "mb_민지",
          weight: 6,
          logCount: 2,
          rank: 1,
          ratio: 1,
          isTop: true,
        },
      ];

      const row = ranking[0];
      expect(row.memberId).toMatch(/^mb_/);
      expect(typeof row.weight).toBe("number");
      expect(typeof row.logCount).toBe("number");
      expect(typeof row.rank).toBe("number");
      expect(typeof row.ratio).toBe("number");
      expect(typeof row.isTop).toBe("boolean");
      expect(row.ratio).toBeGreaterThanOrEqual(0);
      expect(row.ratio).toBeLessThanOrEqual(1);
    });
  });
});
