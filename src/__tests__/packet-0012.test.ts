/**
 * Packet 0012 Tests: 주간 리포트 상세 /report/detail (S6)
 *
 * Tests for src/pages/ReportDetail.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: location.state가 없거나 weekStart가 없어도 크래시 없이 이번 주 리포트를 렌더
 * - AC-2: 공정성 점수가 buildWeeklyReport().fairnessScore와 동일한 정수로 t2 이상 타이포 + 배지 강조
 * - AC-3: 멤버별 기여가 sharePct 내림차순 MiniBar로, 각 행 '이름 · N건 · XX.X%'
 * - AC-4: 요일별 Sparkline이 dailyTrend 7개 값을 그대로 사용, topChores는 최대 3개
 * - AC-5: 미이행 항목(choreName·횟수·벌금) 목록 + '정산 제안 보기' 클릭 시
 *   navigate('/settle', { state: { weekStart } })
 *
 * Implementation contract (testIds the Coder MUST use — see assertions below):
 * - CountUp/Paragraph span for the fairness score: data-testid="fairness-score-value"
 * - a Badge (role="status") rendered near the fairness score
 * - one row per member: data-testid="member-contribution-row" (repeated), containing
 *   a <MiniBar ratio={sharePct/100} /> and the text "{name} · {count}건 · {sharePct.toFixed(1)}%"
 * - one <Sparkline data={dailyTrend} /> for the weekly trend
 * - one row per top chore: data-testid="top-chore-row" (repeated, max 3)
 * - one row per missed item (missedCount > 0 only): data-testid="missed-item-row"
 * - a button named "정산 제안 보기" that calls navigate('/settle', { state: { weekStart } })
 *
 * @/components/MiniBar and @/components/Sparkline are mocked below to expose their props
 * (ratio / data) as data-attributes, so assertions verify the DATA CONTRACT rather than
 * SVG/CSS rendering details.
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path — see packet-0011).
 * buildWeeklyReport/getWeekStart are the REAL @/lib/report implementation (pure, packet-0004)
 * so every expected value below is independently computed, not guessed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { buildWeeklyReport, getWeekStart } from "@/lib/report";
import { todayKST } from "@/lib/storage";
import { formatNumber } from "@/lib/utils";
import type { ChoreSplitState, Member, Chore, CheckIn } from "@/lib/types";

mockAll();

// ── Mock @/components/MiniBar + Sparkline: expose props as data-attributes ──
// (Keeps assertions about the DATA CONTRACT, not SVG geometry/CSS.)
vi.mock("@/components/MiniBar", () => ({
  MiniBar: ({ ratio }: { ratio: number }) =>
    React.createElement("div", { "data-testid": "member-share-bar-mock", "data-ratio": String(ratio) }),
}));
vi.mock("@/components/Sparkline", () => ({
  Sparkline: ({ data }: { data: number[] }) =>
    React.createElement("div", { "data-testid": "sparkline-mock", "data-points": JSON.stringify(data) }),
}));

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

function makeChore(overrides: Partial<Chore> & Pick<Chore, "id" | "name">): Chore {
  return {
    weight: 1,
    frequency: "daily",
    penaltyAmount: 0,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCheckIn(
  date: string,
  choreId: string,
  memberId: string,
  idx: number,
  weightAtLog: 1 | 2 | 3 = 1,
): CheckIn {
  return {
    id: `${date}__${choreId}__${memberId}__${idx}`,
    date,
    choreId,
    memberId,
    weightAtLog,
    createdAt: `${date}T00:00:00.000Z`,
  };
}

function makeState(overrides: Partial<ChoreSplitState> = {}): ChoreSplitState {
  return {
    version: 1,
    household: { id: "h_test1", name: "테스트가구", inviteCode: "AB12CD", createdAt: "2026-01-01T00:00:00.000Z" },
    members: [ME, JIMIN],
    chores: [],
    checkIns: [],
    settings: { reminderEnabled: false, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
    settlements: [],
    ...overrides,
  };
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const THIS_WEEK_START = getWeekStart(todayKST());

beforeEach(() => {
  mockLocation.state = null;
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.unlocked = { [THIS_WEEK_START]: true };
  storeRef.unlock = vi.fn();
  storeRef.state = makeState();
});

// Lazily imported so vi.mock() calls above are in effect first.
async function loadReportDetail() {
  const mod = await import("@/pages/ReportDetail");
  return mod.default;
}

describe("주간 리포트 상세 /report/detail (S6)", () => {
  describe("AC-1[P0]: missing/incomplete location.state falls back to this week", () => {
    it("renders this week's report when location.state is null (direct entry / refresh)", async () => {
      const DISHES = makeChore({ id: "c_1", name: "설거지", weight: 2 });
      storeRef.state = makeState({
        chores: [DISHES],
        checkIns: [makeCheckIn(THIS_WEEK_START, "c_1", "m_me", 1, 2)],
      });
      const expected = buildWeeklyReport(storeRef.state, THIS_WEEK_START);
      mockLocation.state = null;

      const ReportDetail = await loadReportDetail();
      renderWithRouter(React.createElement(ReportDetail));

      expect(screen.getByTestId("fairness-score-value").textContent).toBe(`${expected.fairnessScore}점`);
      expect(screen.getAllByTestId("member-contribution-row")).toHaveLength(expected.stats.length);
    });

    it("renders this week's report when location.state exists but weekStart is missing", async () => {
      const DISHES = makeChore({ id: "c_1", name: "설거지", weight: 2 });
      storeRef.state = makeState({
        chores: [DISHES],
        checkIns: [makeCheckIn(THIS_WEEK_START, "c_1", "m_me", 1, 2)],
      });
      const expected = buildWeeklyReport(storeRef.state, THIS_WEEK_START);
      mockLocation.state = {} as any;

      const ReportDetail = await loadReportDetail();
      renderWithRouter(React.createElement(ReportDetail));

      expect(screen.getByTestId("fairness-score-value").textContent).toBe(`${expected.fairnessScore}점`);
    });
  });

  describe("AC-2[P0]: fairness score is an emphasized integer (t2+ typography + badge)", () => {
    it("shows the exact fairnessScore integer in t1/t2 typography with a status badge next to it", async () => {
      const DISHES = makeChore({ id: "c_1", name: "설거지", weight: 2 });
      storeRef.state = makeState({
        chores: [DISHES],
        checkIns: [
          makeCheckIn(THIS_WEEK_START, "c_1", "m_me", 1, 2),
          makeCheckIn(addDays(THIS_WEEK_START, 1), "c_1", "m_me", 2, 2),
          makeCheckIn(addDays(THIS_WEEK_START, 2), "c_1", "m_me", 3, 2),
          makeCheckIn(addDays(THIS_WEEK_START, 3), "c_1", "m_2", 4, 2),
        ],
      });
      const expected = buildWeeklyReport(storeRef.state, THIS_WEEK_START);
      expect(expected.fairnessScore).toBe(50); // ME 75.0% / JIMIN 25.0% → 100-(75-25)
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const ReportDetail = await loadReportDetail();
      renderWithRouter(React.createElement(ReportDetail));

      const scoreEl = screen.getByTestId("fairness-score-value");
      expect(scoreEl.textContent).toBe("50점");
      const typographyEl = scoreEl.matches("[data-typography]")
        ? scoreEl
        : scoreEl.querySelector("[data-typography]");
      expect(["t1", "t2"]).toContain(typographyEl?.getAttribute("data-typography"));
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("AC-3[P0]: member contribution rows sorted by sharePct desc with MiniBar", () => {
    it("renders '이름 · N건 · XX.X%' per member, highest sharePct first, MiniBar ratio matching", async () => {
      const DISHES = makeChore({ id: "c_1", name: "설거지", weight: 2 });
      storeRef.state = makeState({
        chores: [DISHES],
        checkIns: [
          makeCheckIn(THIS_WEEK_START, "c_1", "m_me", 1, 2),
          makeCheckIn(addDays(THIS_WEEK_START, 1), "c_1", "m_me", 2, 2),
          makeCheckIn(addDays(THIS_WEEK_START, 2), "c_1", "m_me", 3, 2),
          makeCheckIn(addDays(THIS_WEEK_START, 3), "c_1", "m_2", 4, 2),
        ],
      });
      const expected = buildWeeklyReport(storeRef.state, THIS_WEEK_START);
      expect(expected.stats[0].memberName).toBe("민수");
      expect(expected.stats[0].sharePct).toBe(75);
      expect(expected.stats[1].memberName).toBe("지민");
      expect(expected.stats[1].sharePct).toBe(25);
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const ReportDetail = await loadReportDetail();
      renderWithRouter(React.createElement(ReportDetail));

      const rows = screen.getAllByTestId("member-contribution-row");
      expect(rows).toHaveLength(2);
      expect(rows[0].textContent).toContain("민수 · 3건 · 75.0%");
      expect(rows[1].textContent).toContain("지민 · 1건 · 25.0%");

      const bars = screen.getAllByTestId("member-share-bar-mock");
      expect(bars).toHaveLength(2);
      expect(Number(bars[0].getAttribute("data-ratio"))).toBeCloseTo(0.75, 5);
      expect(Number(bars[1].getAttribute("data-ratio"))).toBeCloseTo(0.25, 5);
    });
  });

  describe("AC-4: daily Sparkline uses raw dailyTrend, topChores capped at 3", () => {
    it("passes the 7-value Mon~Sun dailyTrend to Sparkline and shows at most 3 top chores", async () => {
      const chores = [
        makeChore({ id: "c_1", name: "설거지" }),
        makeChore({ id: "c_2", name: "빨래" }),
        makeChore({ id: "c_3", name: "청소" }),
        makeChore({ id: "c_4", name: "분리수거" }),
      ];
      const checkIns: CheckIn[] = [
        ...[0, 1, 2, 3].map((d, i) => makeCheckIn(addDays(THIS_WEEK_START, d), "c_1", "m_me", i)),
        ...[0, 1, 2].map((d, i) => makeCheckIn(addDays(THIS_WEEK_START, d), "c_2", "m_me", 10 + i)),
        ...[0, 1].map((d, i) => makeCheckIn(addDays(THIS_WEEK_START, d), "c_3", "m_me", 20 + i)),
        makeCheckIn(THIS_WEEK_START, "c_4", "m_me", 30),
      ];
      storeRef.state = makeState({ chores, checkIns });
      const expected = buildWeeklyReport(storeRef.state, THIS_WEEK_START);
      expect(expected.dailyTrend).toEqual([4, 3, 2, 1, 0, 0, 0]);
      expect(expected.topChores.map((c) => c.choreName)).toEqual(["설거지", "빨래", "청소"]);
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const ReportDetail = await loadReportDetail();
      renderWithRouter(React.createElement(ReportDetail));

      const sparkline = screen.getByTestId("sparkline-mock");
      expect(JSON.parse(sparkline.getAttribute("data-points")!)).toEqual([4, 3, 2, 1, 0, 0, 0]);

      const topRows = screen.getAllByTestId("top-chore-row");
      expect(topRows).toHaveLength(3);
      expect(topRows.map((r) => r.textContent)).toEqual([
        expect.stringContaining("설거지"),
        expect.stringContaining("빨래"),
        expect.stringContaining("청소"),
      ]);
      expect(topRows.some((r) => r.textContent?.includes("분리수거"))).toBe(false);
    });
  });

  describe("AC-5[P0]: missed items list + settlement navigation", () => {
    it("lists only missedCount>0 items (name/count/penalty) and navigates to /settle on CTA click", async () => {
      const dishes = makeChore({ id: "c_1", name: "설거지", weight: 2, penaltyAmount: 0 });
      const trash = makeChore({ id: "c_2", name: "분리수거", penaltyAmount: 300 });
      const laundry = makeChore({ id: "c_3", name: "빨래", frequency: "weekly", penaltyAmount: 1000 });

      const checkIns: CheckIn[] = Array.from({ length: 7 }, (_, d) =>
        makeCheckIn(addDays(THIS_WEEK_START, d), "c_1", "m_me", d, 2),
      );
      storeRef.state = makeState({ chores: [dishes, trash, laundry], checkIns });
      const expected = buildWeeklyReport(storeRef.state, THIS_WEEK_START);

      const trashItem = expected.missedItems.find((m) => m.choreId === "c_2")!;
      const laundryItem = expected.missedItems.find((m) => m.choreId === "c_3")!;
      const dishesItem = expected.missedItems.find((m) => m.choreId === "c_1")!;
      expect(trashItem.missedCount).toBe(7);
      expect(trashItem.penalty).toBe(2100);
      expect(laundryItem.missedCount).toBe(1);
      expect(laundryItem.penalty).toBe(1000);
      expect(dishesItem.missedCount).toBe(0);
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const ReportDetail = await loadReportDetail();
      renderWithRouter(React.createElement(ReportDetail));

      const missedRows = screen.getAllByTestId("missed-item-row");
      expect(missedRows).toHaveLength(2);
      expect(missedRows.some((r) => r.textContent?.includes("설거지"))).toBe(false);

      const trashRow = missedRows.find((r) => r.textContent?.includes("분리수거"))!;
      expect(trashRow.textContent).toContain("7");
      expect(trashRow.textContent).toContain(formatNumber(2100));

      const laundryRow = missedRows.find((r) => r.textContent?.includes("빨래"))!;
      expect(laundryRow.textContent).toContain("1");
      expect(laundryRow.textContent).toContain(formatNumber(1000));

      fireEvent.click(screen.getByRole("button", { name: "정산 제안 보기" }));
      expect(mockNavigate).toHaveBeenCalledWith("/settle", { state: { weekStart: THIS_WEEK_START } });
    });
  });

  describe("Routing: App.tsx wires /report/detail", () => {
    it("registers a Route for /report/detail so Report.tsx's navigate('/report/detail') resolves", () => {
      const appPath = fileURLToPath(new URL("../App.tsx", import.meta.url));
      const source = readFileSync(appPath, "utf-8");
      expect(/path=["']\/report\/detail["']/.test(source)).toBe(true);
    });
  });
});
