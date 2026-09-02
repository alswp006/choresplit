/**
 * Packet 0014 Tests: 스트릭·랭킹 /streak (S8)
 *
 * Tests for src/pages/Streak.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: 현재 스트릭이 getStreak(state, me.id)와 동일하게 표시되고(testId="streak-current",
 *   "{N}일") 최고 기록(testId="streak-best")도 함께 노출된다
 * - AC-2: 최근 7일(testId="streak-day" × 7, 과거→오늘 순) 점등이 본인 체크인 유무를
 *   data-checked="true"/"false"로 정확히 반영한다(다른 멤버 체크인은 무시)
 * - AC-3: 주간 랭킹(testId="ranking-row")이 weightedScore 내림차순으로 표시되고, 본인 행에
 *   "(나)" 표기 + data-self="true" 강조가 적용된다
 * - AC-4: 체크인이 0건이면 EmptyState "오늘부터 스트릭을 시작해보세요" + "기록하러 가기"
 *   버튼(→ '/')이 표시된다
 * - AC-5: AdSlot이 랭킹 목록 하단에 배치되고 FloatingTabBar(safe-area padding 포함)가 렌더된다
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path — see packet-0010).
 * getStreak is the REAL @/lib/streak implementation (pure, packet-0005) so the current-streak
 * number asserted in AC-1 is independently verified, not guessed. The "best record" (longest
 * historical run) is computed locally in this file from the same fixture dates, pinning a
 * concrete expected number without depending on the page's internal implementation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { getStreak } from "@/lib/streak";
import { todayKST } from "@/lib/storage";
import type { ChoreSplitState, Member, Chore, CheckIn } from "@/lib/types";

mockAll();

// ── Mock @/lib/store (this project's real state path) ──
const { storeRef } = vi.hoisted(() => ({
  storeRef: {
    ready: true as boolean,
    state: {} as any,
    error: null as string | null,
    unlocked: {} as Record<string, true>,
    unlock: vi.fn() as any,
  },
}));

vi.mock("@/lib/store", () => ({
  useAppState: () => storeRef,
  AppStateProvider: ({ children }: any) => children,
}));

const ME: Member = {
  id: "m_me",
  name: "민수",
  colorToken: "blue",
  isMe: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const JIMIN: Member = {
  id: "m_2",
  name: "지민",
  colorToken: "green",
  isMe: false,
  createdAt: "2026-01-02T00:00:00.000Z",
};
const SORA: Member = {
  id: "m_3",
  name: "소라",
  colorToken: "orange",
  isMe: false,
  createdAt: "2026-01-03T00:00:00.000Z",
};
const HYUN: Member = {
  id: "m_4",
  name: "현우",
  colorToken: "purple",
  isMe: false,
  createdAt: "2026-01-04T00:00:00.000Z",
};

const CHORE: Chore = {
  id: "c_1",
  name: "설거지",
  weight: 2,
  frequency: "daily",
  penaltyAmount: 0,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function makeCheckIn(date: string, memberId: string, idx: number): CheckIn {
  return {
    id: `${date}__c_1__${memberId}__${idx}`,
    date,
    choreId: "c_1",
    memberId,
    weightAtLog: 2,
    createdAt: `${date}T00:00:00.000Z`,
  };
}

function makeState(overrides: Partial<ChoreSplitState> = {}): ChoreSplitState {
  return {
    version: 1,
    household: {
      id: "h_test1",
      name: "테스트가구",
      inviteCode: "AB12CD",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    members: [ME, JIMIN, SORA, HYUN],
    chores: [CHORE],
    checkIns: [],
    settings: { reminderEnabled: false, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
    settlements: [],
    ...overrides,
  };
}

// Longest run of consecutive-day dates — independently computed here (not imported from
// the page) so AC-1's "best record" expectation is pinned to a concrete number derived
// from the same fixture, not read back from the implementation under test.
function longestRun(dates: string[]): number {
  const set = new Set(dates);
  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue; // not a run start
    let cursor = d;
    let len = 0;
    while (set.has(cursor)) {
      len += 1;
      cursor = addDays(cursor, 1);
    }
    best = Math.max(best, len);
  }
  return best;
}

const TODAY = todayKST();

beforeEach(() => {
  mockLocation.state = null;
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.state = makeState();
  storeRef.unlocked = {};
  storeRef.unlock = vi.fn();
});

// Lazily imported so vi.mock("@/lib/store") above is in effect first.
async function loadStreak() {
  const mod = await import("@/pages/Streak");
  return mod.default;
}

describe("스트릭·랭킹 /streak (S8)", () => {
  describe("AC-1[P0]: current streak + best record", () => {
    it("shows the current streak from getStreak(state, me.id) and the longest historical run as best record", async () => {
      const dates = [
        TODAY,
        addDays(TODAY, -1),
        addDays(TODAY, -2),
        // gap at -3 breaks the current streak
        addDays(TODAY, -4),
        addDays(TODAY, -5),
        addDays(TODAY, -6),
        addDays(TODAY, -7),
        addDays(TODAY, -8),
      ];
      const checkIns = dates.map((d, i) => makeCheckIn(d, ME.id, i));
      storeRef.state = makeState({ checkIns });

      const expectedCurrent = getStreak(storeRef.state, ME.id);
      expect(expectedCurrent).toBe(3);
      const expectedBest = longestRun(dates);
      expect(expectedBest).toBe(5);

      const Streak = await loadStreak();
      renderWithRouter(React.createElement(Streak));

      expect(screen.getByTestId("streak-current").textContent).toBe(`${expectedCurrent}일`);
      expect(screen.getByTestId("streak-best").textContent).toContain(String(expectedBest));
    });
  });

  describe("AC-2[P0]: last-7-days checkin dots", () => {
    it("marks only the days with my own checkin as active (oldest → today), ignoring other members' checkins", async () => {
      // Checked on T-6, T-4, T-2, T only. JIMIN checks in on T-5 (a day I did NOT check in)
      // to prove the dots reflect *my* checkins, not any member's.
      const myActiveOffsets = [-6, -4, -2, 0];
      const checkIns: CheckIn[] = [
        ...myActiveOffsets.map((off, i) => makeCheckIn(addDays(TODAY, off), ME.id, i)),
        makeCheckIn(addDays(TODAY, -5), JIMIN.id, 100),
      ];
      storeRef.state = makeState({ checkIns });

      const Streak = await loadStreak();
      renderWithRouter(React.createElement(Streak));

      const days = screen.getAllByTestId("streak-day");
      expect(days).toHaveLength(7);
      const checkedFlags = days.map((el) => el.getAttribute("data-checked"));
      expect(checkedFlags).toEqual(["true", "false", "true", "false", "true", "false", "true"]);
    });
  });

  describe("AC-3[P0]: weekly ranking sorted by weightedScore desc, self row highlighted", () => {
    it("orders rows 민수 > 지민 > 소라 > 현우 and marks only the self row with '(나)' + data-self", async () => {
      const checkIns: CheckIn[] = [
        ...Array.from({ length: 6 }, (_, i) => makeCheckIn(addDays(TODAY, -i), ME.id, i)),
        ...Array.from({ length: 4 }, (_, i) => makeCheckIn(addDays(TODAY, -i), JIMIN.id, 10 + i)),
        ...Array.from({ length: 2 }, (_, i) => makeCheckIn(addDays(TODAY, -i), SORA.id, 20 + i)),
        // HYUN: 0 checkins
      ];
      storeRef.state = makeState({ checkIns });

      const Streak = await loadStreak();
      renderWithRouter(React.createElement(Streak));

      const rows = screen.getAllByTestId("ranking-row");
      expect(rows).toHaveLength(4);
      expect(rows[0].textContent).toContain("민수");
      expect(rows[0].textContent).toContain("(나)");
      expect(rows[0].getAttribute("data-self")).toBe("true");
      expect(rows[1].textContent).toContain("지민");
      expect(rows[1].getAttribute("data-self")).toBe("false");
      expect(rows[2].textContent).toContain("소라");
      expect(rows[3].textContent).toContain("현우");
    });
  });

  describe("AC-4[P0]: zero checkins shows the start-streak empty state", () => {
    it("shows '오늘부터 스트릭을 시작해보세요' with a '기록하러 가기' CTA navigating to '/'", async () => {
      storeRef.state = makeState({ checkIns: [] });

      const Streak = await loadStreak();
      renderWithRouter(React.createElement(Streak));

      expect(screen.getByText("오늘부터 스트릭을 시작해보세요")).toBeInTheDocument();

      const cta = screen.getByRole("button", { name: "기록하러 가기" });
      fireEvent.click(cta);
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  describe("AC-5: AdSlot below ranking + FloatingTabBar with safe-area padding", () => {
    it("renders AdSlot after the ranking list, plus a bottom FloatingTabBar with safe-area padding", async () => {
      storeRef.state = makeState({ checkIns: [makeCheckIn(TODAY, ME.id, 1)] });

      const Streak = await loadStreak();
      const { container } = renderWithRouter(React.createElement(Streak));

      const adSlot = container.querySelector("[data-ad-group-id]");
      expect(adSlot).not.toBeNull();

      const rankingRows = screen.getAllByTestId("ranking-row");
      const lastRow = rankingRows[rankingRows.length - 1];
      // adSlot.compareDocumentPosition(lastRow) describes lastRow's position relative to
      // adSlot; DOCUMENT_POSITION_PRECEDING means the ranking row comes before the ad slot.
      const position = adSlot!.compareDocumentPosition(lastRow);
      expect(Boolean(position & Node.DOCUMENT_POSITION_PRECEDING)).toBe(true);

      const tabbar = screen.getByRole("tablist", { name: "메인 네비게이션" });
      expect(tabbar).toBeInTheDocument();
      expect(tabbar.getAttribute("style") ?? "").toContain("calc(");
    });
  });

  describe("Routing: App.tsx wires /streak", () => {
    it("registers a Route for /streak so the tab bar's link resolves", () => {
      const appPath = fileURLToPath(new URL("../App.tsx", import.meta.url));
      const source = readFileSync(appPath, "utf-8");
      expect(/path=["']\/streak["']/.test(source)).toBe(true);
      expect(/from ['"]\.\/pages\/Streak['"]/.test(source)).toBe(true);
    });
  });
});
