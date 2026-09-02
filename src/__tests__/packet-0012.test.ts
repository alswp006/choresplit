import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { ChoreTask, ChoreLog, Household, AppSettings } from "@/lib/types";
import { todayKST } from "@/domain/date";

/**
 * PACKET 0012: src/components/CheckinList.tsx — 홈 체크인 리스트 + 빈 상태 + 배너 광고
 *
 * Expected export from src/components/CheckinList.tsx (NOT YET IMPLEMENTED — red phase):
 *   export function CheckinList(): JSX.Element
 *
 * Reads tasks/logs/household/settings from useAppStore() (@/lib/store), toggles a log
 * via store.toggleLog(date, taskId, memberId) on row tap, shows a Toast + haptic per
 * AC-1/AC-2, renders EmptyState (testId="home-empty") when there are 0 unarchived tasks,
 * and shows a completion message + AdSlot banner once every task for today is checked.
 */

mockTds();
mockAppsInToss();
mockRouter();

const mockUseAppStore = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: () => mockUseAppStore(),
}));

import { CheckinList } from "@/components/CheckinList";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

const TODAY = todayKST();

const MEMBER = { id: "mb_member01", name: "민지", emoji: "🙂", targetShare: 1, createdAt: 1 };

const HOUSEHOLD: Household = {
  id: "hh_test0001",
  name: "테스트집",
  createdAt: 1,
  members: [MEMBER],
};

const SETTINGS: AppSettings = {
  activeMemberId: "mb_member01",
  reminderEnabled: true,
  reminderTime: "21:00",
  onboardingDone: true,
  lastReportWeekKey: null,
  reportUnlockedWeeks: [],
};

const TASK_DISH: ChoreTask = {
  id: "ct_dish0001",
  name: "설거지",
  emoji: "🍽️",
  difficulty: 2,
  repeatDays: [0, 1, 2, 3, 4, 5, 6],
  assigneeId: null,
  fineAmount: 0,
  archived: false,
  updatedAt: 1,
};

const TASK_LAUNDRY: ChoreTask = {
  id: "ct_laundry1",
  name: "빨래",
  emoji: "🧺",
  difficulty: 1,
  repeatDays: [0, 1, 2, 3, 4, 5, 6],
  assigneeId: null,
  fineAmount: 0,
  archived: false,
  updatedAt: 1,
};

const TASK_ARCHIVED: ChoreTask = {
  id: "ct_old000001",
  name: "옛날청소",
  emoji: "🧹",
  difficulty: 1,
  repeatDays: [0, 1, 2, 3, 4, 5, 6],
  assigneeId: null,
  fineAmount: 0,
  archived: true,
  updatedAt: 1,
};

function logFor(taskId: string, memberId = "mb_member01"): ChoreLog {
  return { id: `lg_${TODAY}_${taskId}_${memberId}`, date: TODAY, taskId, memberId, weight: 2, createdAt: 1 };
}

const mockToggleLog = vi.fn();

function setStore(overrides: Record<string, unknown> = {}) {
  mockUseAppStore.mockReturnValue({
    booting: false,
    household: HOUSEHOLD,
    tasks: [TASK_DISH, TASK_LAUNDRY],
    logs: [],
    settings: SETTINGS,
    schemaCompatible: true,
    toast: null,
    toggleLog: mockToggleLog,
    saveTask: vi.fn(),
    saveSettings: vi.fn(),
    ...overrides,
  });
}

function renderList() {
  return render(React.createElement(MemoryRouter, null, React.createElement(CheckinList)));
}

beforeEach(() => {
  mockToggleLog.mockClear();
  mockNavigate.mockClear();
  vi.mocked(generateHapticFeedback).mockClear();
});

describe("홈 체크인 리스트 + 빈 상태 + 배너 광고", () => {
  it("AC-1[P0]: 미체크 항목은 56px 이상 행에 '체크' Chip으로 렌더된다", () => {
    setStore({ logs: [] });
    renderList();

    const rows = screen.getAllByTestId("checkin-row");
    expect(rows).toHaveLength(2);

    const minHeight = parseInt(rows[0].style.minHeight || "0", 10);
    expect(minHeight).toBeGreaterThanOrEqual(56);
    expect(within(rows[0]).getByText("체크")).toBeInTheDocument();
  });

  it("AC-1[P0]: 미체크 행 탭 시 toggleLog가 호출되고 success 햅틱 + 완료 토스트가 뜬다", () => {
    setStore({ logs: [] });
    renderList();

    const rows = screen.getAllByTestId("checkin-row");
    fireEvent.click(rows[0]);

    expect(mockToggleLog).toHaveBeenCalledTimes(1);
    expect(mockToggleLog).toHaveBeenCalledWith(TODAY, "ct_dish0001", "mb_member01");
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
    expect(screen.getByRole("status").textContent).toBe("설거지 완료!");
  });

  it("AC-2[P0]: 체크된 항목은 '완료'(selected) Chip으로 렌더된다 — 새로고침 후에도 상태 유지", () => {
    setStore({ logs: [logFor("ct_dish0001")] });
    renderList();

    const rows = screen.getAllByTestId("checkin-row");
    const chip = within(rows[0]).getByRole("button", { name: "완료" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("AC-2[P0]: 체크된 행 재탭 시 toggleLog가 호출되고 tickWeak 햅틱 + 취소 토스트가 뜬다", () => {
    setStore({ logs: [logFor("ct_dish0001")] });
    renderList();

    const rows = screen.getAllByTestId("checkin-row");
    fireEvent.click(rows[0]);

    expect(mockToggleLog).toHaveBeenCalledTimes(1);
    expect(mockToggleLog).toHaveBeenCalledWith(TODAY, "ct_dish0001", "mb_member01");
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
    expect(screen.getByRole("status").textContent).toBe("기록을 취소했어요");
  });

  it("AC-3: archived===true인 항목은 리스트에 렌더되지 않는다", () => {
    setStore({ tasks: [TASK_DISH, TASK_ARCHIVED], logs: [] });
    renderList();

    expect(screen.getAllByTestId("checkin-row")).toHaveLength(1);
    expect(screen.queryByText("옛날청소")).not.toBeInTheDocument();
  });

  it("AC-4[P0]: 미보관 항목이 0개면 EmptyState가 표시되고 CTA 탭 시 /tasks로 이동한다", () => {
    setStore({ tasks: [], logs: [] });
    renderList();

    const empty = screen.getByTestId("home-empty");
    expect(empty).toBeInTheDocument();
    expect(screen.queryAllByTestId("checkin-row")).toHaveLength(0);

    fireEvent.click(within(empty).getByRole("button"));
    expect(mockNavigate).toHaveBeenCalledWith("/tasks");
  });

  it("AC-4: 등록된 항목이 전부 archived면 EmptyState가 표시된다", () => {
    setStore({ tasks: [TASK_ARCHIVED], logs: [] });
    renderList();

    expect(screen.getByTestId("home-empty")).toBeInTheDocument();
    expect(screen.queryAllByTestId("checkin-row")).toHaveLength(0);
  });

  it("AC-5: 오늘 항목을 모두 완료하면 완료 문구와 AdSlot 배너가 콘텐츠를 덮지 않고 렌더된다", () => {
    setStore({ logs: [logFor("ct_dish0001"), logFor("ct_laundry1")] });
    const { container } = renderList();

    expect(screen.getByText("오늘 할 일 다 했어요 🎉")).toBeInTheDocument();

    const ad = container.querySelector("[data-ad-group-id]");
    expect(ad).toBeInTheDocument();
    expect((ad as HTMLElement).style.position).not.toBe("fixed");
    expect((ad as HTMLElement).style.position).not.toBe("absolute");
  });
});
