import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { ChoreTask, ChoreLog, Household, AppSettings } from "@/lib/types";
import { todayKST, weekKeyOf } from "@/domain/date";

/**
 * PACKET 0011: src/pages/Home.tsx 상단부 — 리마인더 배너 · 구성원 탭 · 히어로
 *
 * Expected: default export from src/pages/Home.tsx (NOT YET IMPLEMENTED — red phase).
 * Reads booting/household/logs/settings/schemaCompatible from useAppStore() (@/lib/store).
 * Renders (in order): boot skeleton while booting, reminder banner (conditional),
 * schema-incompatible banner (conditional), member Tab segment, SummaryHero
 * (testId="today-summary-hero", tappable -> navigate('/report', { state: { weekKey } })),
 * and a week Sparkline. CheckinList integration is out of scope for this packet.
 */

mockTds();
mockAppsInToss();
mockRouter();

const mockUseAppStore = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: () => mockUseAppStore(),
}));

import Home from "@/pages/Home";

const MEMBER_MINJI = { id: "mb_minji0001", name: "민지", emoji: "🐰", targetShare: 0.5, createdAt: 1 };
const MEMBER_HYUNWOO = { id: "mb_hyunwoo01", name: "현우", emoji: "🐻", targetShare: 0.5, createdAt: 2 };

const HOUSEHOLD: Household = {
  id: "hh_test0001",
  name: "우리집",
  createdAt: 1,
  members: [MEMBER_MINJI, MEMBER_HYUNWOO],
};

const TASKS: ChoreTask[] = [];

function baseSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    activeMemberId: "mb_minji0001",
    reminderEnabled: true,
    reminderTime: "21:00",
    onboardingDone: true,
    lastReportWeekKey: null,
    reportUnlockedWeeks: [],
    ...overrides,
  };
}

const mockSaveSettings = vi.fn();

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
    saveSettings: mockSaveSettings,
    ...overrides,
  });
}

function renderHome() {
  return render(React.createElement(MemoryRouter, null, React.createElement(Home)));
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockSaveSettings.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("홈 상단부 — 리마인더 배너 · 구성원 탭 · 히어로", () => {
  it("AC-1[P0]: booting===true인 동안 boot-skeleton만 보이고 히어로는 렌더되지 않는다", () => {
    setStore({ booting: true });
    renderHome();

    expect(screen.getByTestId("boot-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("today-summary-hero")).not.toBeInTheDocument();
  });

  it("AC-1[P0]: 로드 완료 후 boot-skeleton이 사라지고 today-summary-hero가 렌더된다", () => {
    const TODAY = todayKST();
    setStore({
      booting: false,
      logs: [
        { id: `lg_${TODAY}_t1_mb_minji0001`, date: TODAY, taskId: "t1", memberId: "mb_minji0001", weight: 2, createdAt: 1 },
      ] as ChoreLog[],
    });
    renderHome();

    expect(screen.queryByTestId("boot-skeleton")).not.toBeInTheDocument();
    const hero = screen.getByTestId("today-summary-hero");
    expect(hero).toBeInTheDocument();
    expect(hero.textContent).toContain("2");
  });

  it("AC-2[P0]: reminderTime 이후이고 오늘 로그가 0건이면 reminder-banner가 표시된다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:30:00.000Z")); // KST 21:30
    const TODAY = todayKST();

    setStore({
      settings: baseSettings({ reminderEnabled: true, reminderTime: "21:00" }),
      logs: [] as ChoreLog[],
    });
    renderHome();

    const banner = screen.getByTestId("reminder-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/체크인/);
    expect(TODAY).toBe("2026-09-02");
  });

  it("AC-2[P0]: 오늘 로그가 1건 이상이면 reminder-banner가 표시되지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:30:00.000Z")); // KST 21:30
    const TODAY = todayKST();

    setStore({
      settings: baseSettings({ reminderEnabled: true, reminderTime: "21:00" }),
      logs: [
        { id: `lg_${TODAY}_t1_mb_minji0001`, date: TODAY, taskId: "t1", memberId: "mb_minji0001", weight: 2, createdAt: 1 },
      ] as ChoreLog[],
    });
    renderHome();

    expect(screen.queryByTestId("reminder-banner")).not.toBeInTheDocument();
    expect(TODAY).toBe("2026-09-02");
  });

  it("AC-3[P0]: 구성원 Tab을 탭하면 선택 구성원이 바뀌고 오늘 기여 점수가 갱신된다", () => {
    const TODAY = todayKST();
    setStore({
      settings: baseSettings({ activeMemberId: "mb_minji0001" }),
      logs: [
        { id: `lg_${TODAY}_t1_mb_minji0001`, date: TODAY, taskId: "t1", memberId: "mb_minji0001", weight: 2, createdAt: 1 },
        { id: `lg_${TODAY}_t2_mb_minji0001`, date: TODAY, taskId: "t2", memberId: "mb_minji0001", weight: 1, createdAt: 2 },
        { id: `lg_${TODAY}_t3_mb_hyunwoo01`, date: TODAY, taskId: "t3", memberId: "mb_hyunwoo01", weight: 2, createdAt: 3 },
      ] as ChoreLog[],
    });
    renderHome();

    const hero = screen.getByTestId("today-summary-hero");
    expect(hero.textContent).toContain("3");

    const hyunwooTab = screen.getByRole("tab", { name: /현우/ });
    fireEvent.click(hyunwooTab);

    expect(hero.textContent).toContain("2");
    expect(hyunwooTab).toHaveAttribute("aria-selected", "true");
  });

  it("AC-4[P0]: 히어로 탭 시 navigate('/report', { state: { weekKey } })가 호출된다", () => {
    const TODAY = todayKST();
    setStore({ logs: [] as ChoreLog[] });
    renderHome();

    const hero = screen.getByTestId("today-summary-hero");
    fireEvent.click(hero);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/report", { state: { weekKey: weekKeyOf(TODAY) } });
  });

  it("AC-5: schemaCompatible===false이면 형식 불일치 안내 배너가 표시된다", () => {
    setStore({ schemaCompatible: false });
    renderHome();

    expect(screen.getByText("기록 형식이 달라 일부 기능이 제한돼요")).toBeInTheDocument();
  });
});
