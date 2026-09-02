import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import type { ChoreTask, ChoreLog, Household, AppSettings } from "@/lib/types";
import { weekKeyOf, shiftWeek } from "@/domain/date";

/**
 * PACKET 0015: src/pages/Report.tsx — 주간 리포트 요약 (히어로 · 주 이동 · 빈 상태)
 *
 * Expected: default export from src/pages/Report.tsx (NOT YET IMPLEMENTED — red phase).
 * Reads booting/household/tasks/logs/settings from useAppStore() (@/lib/store).
 * Resolves the active weekKey with this precedence: ?week query param > location.state.weekKey
 * > current week (weekKeyOf(todayKST())).
 * Prev/next week buttons (accessible names "이전 주" / "다음 주") shift the week and sync the
 * ?week query param (so a reload of the same URL reproduces the same week). Prev is disabled
 * 12 weeks back from the current week (MAX_WEEK_BACK); next is disabled once at the current week
 * (no navigating into the future).
 * Renders calcFairness(weeklyWeightsByMember(logs, weekKey), targets) as a SummaryHero
 * (testId="report-score-hero") showing the score (e.g. "80점") and gradeOf(score) grade label
 * (e.g. "양호"). If the active week has zero logs, shows EmptyState text
 * "이 주에는 기록이 없어요" instead of the score hero.
 */

mockTds();
mockAppsInToss();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAppStore = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: () => mockUseAppStore(),
}));

import Report from "@/pages/Report";

const MEMBER_A = { id: "mb_aaaaaaaaaa", name: "민지", emoji: "🐰", targetShare: 0.5, createdAt: 1 };
const MEMBER_B = { id: "mb_bbbbbbbbbb", name: "현우", emoji: "🐻", targetShare: 0.5, createdAt: 2 };

const HOUSEHOLD: Household = {
  id: "hh_test0001",
  name: "우리집",
  createdAt: 1,
  members: [MEMBER_A, MEMBER_B],
};

const TASKS: ChoreTask[] = [];

function baseSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    activeMemberId: MEMBER_A.id,
    reminderEnabled: true,
    reminderTime: "21:00",
    onboardingDone: true,
    lastReportWeekKey: null,
    reportUnlockedWeeks: [],
    ...overrides,
  };
}

function setStore(overrides: Record<string, unknown> = {}) {
  mockUseAppStore.mockReturnValue({
    booting: false,
    household: HOUSEHOLD,
    tasks: TASKS,
    logs: [] as ChoreLog[],
    settings: baseSettings(),
    schemaCompatible: true,
    toast: null,
    toggleLog: vi.fn(),
    saveTask: vi.fn(),
    saveSettings: vi.fn(),
    ...overrides,
  });
}

// weight 6 for A vs weight 4 for B against 50/50 targets -> fairness 80 ("양호")
function fairLogsFor(weekKey: string, aDates: string[], bDates: string[]): ChoreLog[] {
  const aLogs = aDates.map((date, i) => ({
    id: `lg_${date}_ta${i}_${MEMBER_A.id}`,
    date,
    taskId: `ta${i}`,
    memberId: MEMBER_A.id,
    weight: 2 as const,
    createdAt: i,
  }));
  const bLogs = bDates.map((date, i) => ({
    id: `lg_${date}_tb${i}_${MEMBER_B.id}`,
    date,
    taskId: `tb${i}`,
    memberId: MEMBER_B.id,
    weight: 2 as const,
    createdAt: 100 + i,
  }));
  expect(weekKeyOf(aDates[0])).toBe(weekKey);
  return [...aLogs, ...bLogs];
}

// 2026-W35 range: 2026-08-24 (Mon) .. 2026-08-30 (Sun)
const W35_A_DATES = ["2026-08-24", "2026-08-25", "2026-08-26"]; // weight 2*3=6
const W35_B_DATES = ["2026-08-27", "2026-08-28"]; // weight 2*2=4
// 2026-W36 range: 2026-08-31 (Mon) .. 2026-09-06 (Sun) — deliberately very unbalanced,
// so a test can tell whether the component picked W35 or W36 data.
const W36_A_DATES = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]; // weight 10
const W36_B_DATES: string[] = []; // weight 0

function SearchDisplay() {
  const [params] = useSearchParams();
  return React.createElement("div", { "data-testid": "current-search" }, params.toString());
}

function renderReport(initialEntries: Parameters<typeof MemoryRouter>[0]["initialEntries"]) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries },
      React.createElement(Report),
      React.createElement(SearchDisplay),
    ),
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("주간 리포트 요약 /report (히어로 · 주 이동 · 빈 상태)", () => {
  it("AC-1: ?week=2026-W35로 진입하면 그 주 데이터만 반영된 80점/양호 히어로가 표시된다", () => {
    setStore({
      logs: [
        ...fairLogsFor("2026-W35", W35_A_DATES, W35_B_DATES),
        ...fairLogsFor("2026-W36", W36_A_DATES, W36_B_DATES),
      ] as ChoreLog[],
    });

    renderReport(["/report?week=2026-W35"]);

    const hero = screen.getByTestId("report-score-hero");
    expect(hero.textContent).toContain("80");
    expect(hero.textContent).toContain("양호");
  });

  it("AC-1: state.weekKey만 있고 쿼리가 없으면 state의 주가 사용된다", () => {
    setStore({ logs: fairLogsFor("2026-W35", W35_A_DATES, W35_B_DATES) as ChoreLog[] });

    const { container } = renderReport([{ pathname: "/report", state: { weekKey: "2026-W35" } }]);
    console.log("DEBUG_HTML", container.innerHTML);

    const hero = screen.getByTestId("report-score-hero");
    expect(hero.textContent).toContain("80");
    expect(hero.textContent).toContain("양호");
  });

  it("AC-1: 쿼리도 state도 없으면 이번 주가 기준이 되어 이전 주 버튼을 누르면 그 전주로 이동한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:30:00.000Z")); // KST 2026-09-02, 이번 주 = 2026-W36
    setStore({ logs: [] as ChoreLog[] });

    renderReport(["/report"]);

    fireEvent.click(screen.getByRole("button", { name: "이전 주" }));

    expect(screen.getByTestId("current-search").textContent).toBe("week=2026-W35");
  });

  it("AC-2: 이전 주 버튼을 12회 누르면 12주 전에서 disabled 되고 더는 과거로 이동하지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:30:00.000Z")); // 이번 주 = 2026-W36
    setStore({ logs: [] as ChoreLog[] });

    renderReport(["/report"]);
    const prevButton = screen.getByRole("button", { name: "이전 주" });

    for (let i = 0; i < 12; i++) {
      fireEvent.click(prevButton);
    }

    expect(screen.getByTestId("current-search").textContent).toBe(`week=${shiftWeek("2026-W36", -12)}`);
    expect(screen.getByTestId("current-search").textContent).toBe("week=2026-W24");
    expect(prevButton).toBeDisabled();

    fireEvent.click(prevButton);
    expect(screen.getByTestId("current-search").textContent).toBe("week=2026-W24");
  });

  it("AC-2: 이번 주(기본값)에서는 다음 주 버튼이 disabled 된다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:30:00.000Z"));
    setStore({ logs: [] as ChoreLog[] });

    renderReport(["/report"]);

    expect(screen.getByRole("button", { name: "다음 주" })).toBeDisabled();
  });

  it("AC-3: 가중치 6:4, 목표 5:5인 주는 히어로에 '80점'과 등급 '양호'가 표시된다", () => {
    setStore({ logs: fairLogsFor("2026-W35", W35_A_DATES, W35_B_DATES) as ChoreLog[] });

    renderReport(["/report?week=2026-W35"]);

    const hero = screen.getByTestId("report-score-hero");
    expect(hero.textContent).toContain("80점");
    expect(hero.textContent).toContain("양호");
  });

  it("AC-4: 해당 주 로그가 0건이면 EmptyState가 표시되고 점수 히어로는 렌더되지 않는다", () => {
    setStore({ logs: [] as ChoreLog[] });

    renderReport(["/report?week=2026-W20"]);

    expect(screen.getByText("이 주에는 기록이 없어요")).toBeInTheDocument();
    expect(screen.queryByTestId("report-score-hero")).not.toBeInTheDocument();
  });

  it("AC-5: 주 이동 후 남은 ?week 쿼리로 새로 마운트해도(새로고침 시뮬레이션) 같은 주 데이터가 유지된다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:30:00.000Z")); // 이번 주 = 2026-W36
    setStore({ logs: [] as ChoreLog[] });

    const { unmount } = renderReport(["/report"]);
    fireEvent.click(screen.getByRole("button", { name: "이전 주" }));
    const search = screen.getByTestId("current-search").textContent;
    expect(search).toBe("week=2026-W35");
    unmount();

    // 새로고침 시뮬레이션: 남은 쿼리 문자열로 컴포넌트를 처음부터 다시 마운트
    setStore({ logs: fairLogsFor("2026-W35", W35_A_DATES, W35_B_DATES) as ChoreLog[] });
    renderReport([`/report?${search}`]);

    const hero = screen.getByTestId("report-score-hero");
    expect(hero.textContent).toContain("80");
    expect(hero.textContent).toContain("양호");
  });
});
