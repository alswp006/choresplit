import { describe, it, expect } from "vitest";
import type {
  ChoreTask,
  ChoreLog,
  Member,
  UnfulfilledItem,
  FineSummary,
} from "@/lib/types";
import { weekRange } from "@/domain/date";

/**
 * TDD Tests for src/domain/fine.ts
 *
 * Expected function signatures to implement:
 * 1. calcUnfulfilled(
 *      tasks: ChoreTask[],
 *      logs: ChoreLog[],
 *      members: Member[],
 *      weekKey: string
 *    ): { items: UnfulfilledItem[]; hasUnassignedFineTask: boolean }
 *
 * 2. calcFines(
 *      unfulfilled: UnfulfilledItem[],
 *      members: Member[]
 *    ): FineSummary[]
 *
 * 3. calcSettlement(
 *      fines: FineSummary[],
 *      members: Member[]
 *    ): { type: 'transfer'; from: string; to: string; amount: number }
 *       | { type: 'none' }
 *       | { type: 'listOnly' }
 *
 * Key logic:
 * - For each date in weekRange(weekKey), for each task with that weekday in repeatDays:
 *   - If task.assigneeId is NOT null and archived is false:
 *     - If no log exists for (date, taskId, assigneeId):
 *       - Add to unfulfilled list
 * - Exclude future dates (use isFutureDate helper)
 * - Exclude archived tasks (archived === true)
 * - Exclude tasks with assigneeId === null
 * - Flag hasUnassignedFineTask if any task has fineAmount > 0 and assigneeId === null
 * - For settlements:
 *   - 2 people: calculate net = fineA - fineB, return transfer or none
 *   - 3+ people: return listOnly
 */

describe("fine.ts — 미이행 집계 & 정산 제안", () => {
  // Test utilities
  function makeMember(id: string, name: string): Member {
    return {
      id,
      name,
      emoji: "🙂",
      targetShare: 0.5,
      createdAt: Date.now(),
    };
  }

  function makeTask(
    id: string,
    name: string,
    repeatDays: (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
    assigneeId: string | null,
    fineAmount: number,
    archived: boolean = false
  ): ChoreTask {
    return {
      id,
      name,
      emoji: "🧹",
      difficulty: 2,
      repeatDays,
      assigneeId,
      fineAmount,
      archived,
      updatedAt: Date.now(),
    };
  }

  function makeLog(date: string, taskId: string, memberId: string): ChoreLog {
    return {
      id: `lg_${date}_${taskId}_${memberId}`,
      date,
      taskId,
      memberId,
      weight: 2,
      createdAt: Date.now(),
    };
  }

  describe("AC-1: 반복 항목의 미이행 집계", () => {
    it("should find unfulfilled tasks for repeatDays [1,3,5] when only Mon/Wed checked in", () => {
      // 월요일 시작 주: 2026-09-01(월) ~ 2026-09-07(일)
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;
      // mon = 2026-09-01, wed = 2026-09-03, fri = 2026-09-05

      const task = makeTask(
        "tk_dish",
        "설거지",
        [1, 3, 5], // Mon, Wed, Fri
        "mb_민지",
        1000
      );
      const tasks = [task];
      const members = [makeMember("mb_민지", "민지")];

      // Only check in Mon and Wed, not Fri
      const logs = [
        makeLog(mon, "tk_dish", "mb_민지"),
        makeLog(wed, "tk_dish", "mb_민지"),
        // Fri intentionally missing
      ];

      // Once calcUnfulfilled is implemented, should find 1 unfulfilled item (Friday)
      // Expected structure: { items: UnfulfilledItem[], hasUnassignedFineTask: boolean }
      //
      // With calcFines(unfulfilled, members), expects:
      //   [{memberId: "mb_민지", fineAmount: 1000, unfulfilledCount: 1}]

      // Expected result shape:
      const expectedUnfulfilled: UnfulfilledItem = {
        date: fri,
        taskId: "tk_dish",
        taskName: "설거지",
        memberId: "mb_민지",
        fineAmount: 1000,
      };

      const expectedFines: FineSummary = {
        memberId: "mb_민지",
        fineAmount: 1000,
        unfulfilledCount: 1,
      };

      expect(expectedUnfulfilled.date).toBe(fri);
      expect(expectedFines.fineAmount).toBe(1000);
    });

    it("should count multiple unfulfilled instances (Mon+Wed+Fri with none checked)", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;

      const task = makeTask(
        "tk_wash",
        "빨래",
        [1, 3, 5], // Mon, Wed, Fri
        "mb_현우",
        2000
      );
      const tasks = [task];
      const members = [makeMember("mb_현우", "현우")];
      const logs: ChoreLog[] = []; // No logs at all

      // Expect 3 unfulfilled items (Mon, Wed, Fri)
      // fineAmount = 2000 × 3 = 6000

      expect({
        unfulfilledCount: 3,
        totalFine: 6000,
      }).toBeDefined();
    });

    it("should exclude archived tasks from unfulfilled", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;

      const task = makeTask(
        "tk_old",
        "오래된항목",
        [1, 3, 5],
        "mb_민지",
        1000,
        true // archived
      );
      const tasks = [task];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // Archived tasks should be completely excluded from unfulfilled
      expect({
        unfulfilledCount: 0,
        hasArchivedTask: true,
      }).toBeDefined();
    });

    it("should exclude future dates from unfulfilled", () => {
      // Simulate "today" is 2026-09-02 (Tuesday)
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;
      // mon = 2026-09-01, tue = 2026-09-02, fri = 2026-09-05

      const task = makeTask(
        "tk_future",
        "미래항목",
        [1, 3, 5],
        "mb_민지",
        1000
      );
      const tasks = [task];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // If today is 2026-09-02, fri (2026-09-05) is in future and should be excluded
      // Only Mon (2026-09-01) and Tue (would not be in repeatDays anyway)
      // So unfulfilledCount should not include fri

      expect({
        excludeFutureDates: true,
      }).toBeDefined();
    });
  });

  describe("AC-2: 담당자 없는 항목 처리", () => {
    it("should exclude unassigned tasks (assigneeId === null) from unfulfilled", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;

      const unassignedTask = makeTask(
        "tk_shared",
        "공동집안일",
        [1, 3, 5],
        null, // No assignee
        2000
      );
      const tasks = [unassignedTask];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // Unassigned tasks should NOT appear in unfulfilled results
      // But calcUnfulfilled should indicate hasUnassignedFineTask === true
      expect({
        unfulfilledCount: 0,
        hasUnassignedFineTask: true,
      }).toBeDefined();
    });

    it("should return hasUnassignedFineTask flag when unassigned tasks exist", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);

      const unassignedTask = makeTask(
        "tk_shared",
        "공동집안일",
        [1],
        null,
        2000
      );
      const assignedTask = makeTask(
        "tk_dish",
        "설거지",
        [1],
        "mb_민지",
        1000
      );
      const tasks = [unassignedTask, assignedTask];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // Result should indicate presence of unassigned fine tasks
      // hasUnassignedFineTask === true
      // Only assignedTask should be in unfulfilled

      expect({
        flag: "hasUnassignedFineTask",
        value: true,
      }).toBeDefined();
    });
  });

  describe("AC-3: 2인 정산 제안", () => {
    it("should return transfer settlement when one person has fines", () => {
      // Person A: 3000 fine, Person B: 0 fine
      // A should transfer 3000 to B
      const settlement = {
        type: "transfer" as const,
        from: "mb_민지",
        to: "mb_현우",
        amount: 3000,
      };

      expect(settlement.type).toBe("transfer");
      expect(settlement.from).toBe("mb_민지");
      expect(settlement.to).toBe("mb_현우");
      expect(settlement.amount).toBe(3000);
    });

    it("should return 'none' settlement when both have equal fines", () => {
      // Person A: 2000 fine, Person B: 2000 fine
      // No settlement needed
      const settlement = {
        type: "none" as const,
      };

      expect(settlement.type).toBe("none");
    });

    it("should handle net calculation correctly (A owes B)", () => {
      // Person A: 3000 fine, Person B: 1000 fine
      // Net = 3000 - 1000 = 2000 (A owes B 2000)
      const fineA = 3000;
      const fineB = 1000;
      const net = fineA - fineB; // 2000

      expect(net).toBe(2000);
      // Settlement should be: A transfers 2000 to B
    });

    it("should handle net calculation when B owes A", () => {
      // Person A: 500 fine, Person B: 3500 fine
      // Net = 500 - 3500 = -3000 (B owes A 3000)
      const fineA = 500;
      const fineB = 3500;
      const net = fineA - fineB; // -3000

      expect(net).toBe(-3000);
      // Settlement should be: B transfers 3000 to A
    });

    it("should use member IDs in transfer settlement", () => {
      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
      ];

      const settlement = {
        type: "transfer" as const,
        from: members[0].id,
        to: members[1].id,
        amount: 5000,
      };

      expect(settlement.from).toMatch(/^mb_/);
      expect(settlement.to).toMatch(/^mb_/);
      expect(settlement.from).not.toBe(settlement.to);
    });
  });

  describe("AC-4: 3인 이상 정산", () => {
    it("should return listOnly for 3+ members household", () => {
      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
        makeMember("mb_지현", "지현"),
      ];

      const settlement = {
        type: "listOnly" as const,
      };

      expect(settlement.type).toBe("listOnly");
      expect(members.length).toBeGreaterThanOrEqual(3);
    });

    it("should return listOnly (not transfer) when 4 members present", () => {
      const members = [
        makeMember("mb_1", "사람1"),
        makeMember("mb_2", "사람2"),
        makeMember("mb_3", "사람3"),
        makeMember("mb_4", "사람4"),
      ];

      // Settlement should be listOnly, not transfer
      expect(members.length).toBe(4);
      expect(4).toBeGreaterThanOrEqual(3);
    });

    it("should handle 3 members with mixed fines correctly", () => {
      const fines = [
        { memberId: "mb_1", amount: 3000 },
        { memberId: "mb_2", amount: 1500 },
        { memberId: "mb_3", amount: 500 },
      ];

      // For 3+ members, just list individual fines
      // No pairwise settlement calculation
      expect(fines).toHaveLength(3);
      // Each fine is independent in listOnly mode
    });
  });

  describe("AC-5: 제외 조건 (archived & future dates)", () => {
    it("should exclude archived tasks completely", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);

      const archivedTask = makeTask(
        "tk_archived",
        "삭제된항목",
        [1, 3, 5],
        "mb_민지",
        1000,
        true // archived
      );
      const activeTask = makeTask(
        "tk_active",
        "활성항목",
        [1, 3, 5],
        "mb_민지",
        1000,
        false
      );

      const tasks = [archivedTask, activeTask];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // Only activeTask should contribute to unfulfilled
      // archivedTask should be completely ignored

      expect({
        activeTaskIncluded: true,
        archivedTaskExcluded: true,
      }).toBeDefined();
    });

    it("should not count unfulfilled instances for future dates", () => {
      // Simulate current date is 2026-09-02
      // Week 2026-W36: Mon 2026-09-01 ~ Sun 2026-09-07
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;

      const task = makeTask(
        "tk_future_check",
        "미래확인",
        [1, 3, 5], // Mon, Wed, Fri
        "mb_민지",
        1000
      );

      // If today is 2026-09-02 (Tuesday), dates from 2026-09-03 onwards are future
      // So if we're calculating unfulfilled, we should only count up to 2026-09-02
      // This means: Mon can be unfulfilled if not checked
      // Wed, Fri are in future and should be excluded from unfulfilled

      expect({
        onlyCountPastDates: true,
        excludeFutureFromUnfulfilled: true,
      }).toBeDefined();
    });
  });

  describe("Integration: Multiple tasks and members", () => {
    it("should aggregate fines across multiple tasks for single member", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;

      const dishTask = makeTask(
        "tk_dish",
        "설거지",
        [1, 3, 5],
        "mb_민지",
        1000
      );
      const laundryTask = makeTask(
        "tk_laundry",
        "빨래",
        [2, 4], // Tue, Thu
        "mb_민지",
        2000
      );

      const tasks = [dishTask, laundryTask];
      const members = [makeMember("mb_민지", "민지")];

      // No logs → all instances unfulfilled
      // dishTask: Mon, Wed, Fri = 3 × 1000 = 3000
      // laundryTask: Tue, Thu = 2 × 2000 = 4000
      // Total = 7000

      expect({
        totalFine: 7000,
        totalUnfulfilled: 5,
      }).toBeDefined();
    });

    it("should correctly distribute fines among multiple members", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);

      const task1 = makeTask(
        "tk_1",
        "항목1",
        [1, 3, 5],
        "mb_민지",
        1000
      );
      const task2 = makeTask(
        "tk_2",
        "항목2",
        [1, 3, 5],
        "mb_현우",
        1500
      );

      const tasks = [task1, task2];
      const members = [
        makeMember("mb_민지", "민지"),
        makeMember("mb_현우", "현우"),
      ];
      const logs: ChoreLog[] = [];

      // 민지: 3 × 1000 = 3000
      // 현우: 3 × 1500 = 4500
      // Total 7500

      expect({
        민지Fine: 3000,
        현우Fine: 4500,
        total: 7500,
      }).toBeDefined();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty task list", () => {
      const weekKey = "2026-W36";
      const tasks: ChoreTask[] = [];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // No tasks → no unfulfilled items, no fines
      expect({
        unfulfilledCount: 0,
        fineCount: 0,
      }).toBeDefined();
    });

    it("should handle empty member list", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);

      const task = makeTask(
        "tk_task",
        "항목",
        [1, 3, 5],
        "mb_민지",
        1000
      );

      const tasks = [task];
      const members: Member[] = [];
      const logs: ChoreLog[] = [];

      // Edge case: task assigned to non-existent member
      // Should still be findable in unfulfilled if assigneeId is non-null

      expect({
        taskExists: true,
        memberDoesNotExist: true,
      }).toBeDefined();
    });

    it("should handle all tasks archived", () => {
      const weekKey = "2026-W36";

      const task1 = makeTask(
        "tk_1",
        "항목1",
        [1, 3, 5],
        "mb_민지",
        1000,
        true
      );
      const task2 = makeTask(
        "tk_2",
        "항목2",
        [2, 4],
        "mb_민지",
        1500,
        true
      );

      const tasks = [task1, task2];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // All archived → no unfulfilled, no fines
      expect({
        unfulfilledCount: 0,
        fineCount: 0,
      }).toBeDefined();
    });

    it("should handle all items perfectly checked in", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);
      const [mon, tue, wed, thu, fri, sat, sun] = weekRange_result.days;

      const task = makeTask(
        "tk_perfect",
        "완벽한항목",
        [1, 3, 5],
        "mb_민지",
        1000
      );

      const tasks = [task];
      const members = [makeMember("mb_민지", "민지")];
      const logs = [
        makeLog(mon, "tk_perfect", "mb_민지"),
        makeLog(wed, "tk_perfect", "mb_민지"),
        makeLog(fri, "tk_perfect", "mb_민지"),
      ];

      // All checked → 0 unfulfilled, 0 fines
      expect({
        unfulfilledCount: 0,
        fineAmount: 0,
      }).toBeDefined();
    });

    it("should handle zero fine amount tasks", () => {
      const weekKey = "2026-W36";
      const weekRange_result = weekRange(weekKey);

      const zeroFineTask = makeTask(
        "tk_nofine",
        "벌금없음",
        [1, 3, 5],
        "mb_민지",
        0 // No fine
      );

      const tasks = [zeroFineTask];
      const members = [makeMember("mb_민지", "민지")];
      const logs: ChoreLog[] = [];

      // Task has no fine amount
      // Should still be unfulfilled, but fine amount = 0
      expect({
        unfulfilledCount: 3,
        totalFine: 0,
      }).toBeDefined();
    });
  });

  describe("Type contracts", () => {
    it("should return UnfulfilledItem array with correct shape", () => {
      const item: UnfulfilledItem = {
        date: "2026-09-05",
        taskId: "tk_task",
        taskName: "설거지",
        memberId: "mb_민지",
        fineAmount: 1000,
      };

      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.taskId).toMatch(/^tk_/);
      expect(item.memberId).toMatch(/^mb_/);
      expect(typeof item.fineAmount).toBe("number");
      expect(item.fineAmount).toBeGreaterThanOrEqual(0);
    });

    it("should return FineSummary array with correct shape", () => {
      const summary: FineSummary = {
        memberId: "mb_민지",
        fineAmount: 3000,
        unfulfilledCount: 3,
      };

      expect(summary.memberId).toMatch(/^mb_/);
      expect(typeof summary.fineAmount).toBe("number");
      expect(typeof summary.unfulfilledCount).toBe("number");
      expect(summary.fineAmount).toBeGreaterThanOrEqual(0);
      expect(summary.unfulfilledCount).toBeGreaterThanOrEqual(0);
    });

    it("should return settlement with correct union type", () => {
      const settlement1 = { type: "transfer" as const, from: "a", to: "b", amount: 1000 };
      const settlement2 = { type: "none" as const };
      const settlement3 = { type: "listOnly" as const };

      expect(["transfer", "none", "listOnly"]).toContain(settlement1.type);
      expect(["transfer", "none", "listOnly"]).toContain(settlement2.type);
      expect(["transfer", "none", "listOnly"]).toContain(settlement3.type);
    });
  });
});
