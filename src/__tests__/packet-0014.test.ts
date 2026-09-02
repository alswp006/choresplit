import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import type { ChoreTask, Household } from "@/lib/types";

/**
 * PACKET 0014: src/components/TaskEditSheet.tsx — 항목 추가/편집 BottomSheet + 검증
 *
 * Expected export from src/components/TaskEditSheet.tsx (NOT YET IMPLEMENTED — red phase):
 *   export function TaskEditSheet({ open, taskId, onClose }: {
 *     open: boolean;
 *     taskId: string | null; // null = 새 항목 생성 모드
 *     onClose: () => void;
 *   }): JSX.Element
 *
 * Reads household/tasks/saveTask from useAppStore() (@/lib/store). When taskId is not
 * null, looks up the existing task in store.tasks to prefill the form (edit mode).
 * On submit: validates name/fineAmount, and if valid calls store.saveTask(task) with a
 * fully-formed ChoreTask, calls generateHapticFeedback({ type: "success" }), then onClose().
 * If invalid: shows inline TextField hasError + help (role="alert"), does NOT call saveTask.
 *
 * UI contract used by these tests:
 * - Name TextField: placeholder="예: 설거지" (query via getByPlaceholderText)
 * - Fine amount TextField: placeholder="예: 500", inputMode="numeric"
 * - Difficulty: 3 ChipItem — "쉬움" / "보통" / "어려움" (exactly one selected at a time)
 * - Repeat days: 7 ChipItem — "일" "월" "화" "수" "목" "금" "토" (index = Weekday 0~6, multi-select)
 * - Assignee: ChipItem per household member (member.name) + one "공동" ChipItem
 *   (selecting "공동" → assigneeId: null)
 * - Submit button (전체폭, block/SubmitFooter): role="button", name "추가하기" (create mode)
 */

mockTds();
mockAppsInToss();

const mockSaveTask = vi.fn();

const MEMBER_A = { id: "mb_member01", name: "민지", emoji: "🙂", targetShare: 0.5, createdAt: 1 };
const MEMBER_B = { id: "mb_member02", name: "태호", emoji: "😎", targetShare: 0.5, createdAt: 1 };

const HOUSEHOLD: Household = {
  id: "hh_test0001",
  name: "테스트집",
  createdAt: 1,
  members: [MEMBER_A, MEMBER_B],
};

const mockUseAppStore = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: () => mockUseAppStore(),
}));

import { TaskEditSheet } from "@/components/TaskEditSheet";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

function setStore(overrides: Record<string, unknown> = {}) {
  mockUseAppStore.mockReturnValue({
    booting: false,
    household: HOUSEHOLD,
    tasks: [] as ChoreTask[],
    logs: [],
    settings: {
      activeMemberId: "mb_member01",
      reminderEnabled: true,
      reminderTime: "21:00",
      onboardingDone: true,
      lastReportWeekKey: null,
      reportUnlockedWeeks: [],
    },
    schemaCompatible: true,
    toast: null,
    toggleLog: vi.fn(),
    saveTask: mockSaveTask,
    saveSettings: vi.fn(),
    ...overrides,
  });
}

function renderSheet(onClose = vi.fn()) {
  render(React.createElement(TaskEditSheet, { open: true, taskId: null, onClose }));
  return { onClose };
}

function submitButton() {
  return screen.getByRole("button", { name: "추가하기" });
}

function fillValidName() {
  fireEvent.change(screen.getByPlaceholderText("예: 설거지"), { target: { value: "청소" } });
}

beforeEach(() => {
  mockSaveTask.mockClear();
  vi.mocked(generateHapticFeedback).mockClear();
  setStore();
});

describe("항목 추가/편집 BottomSheet + 검증", () => {
  it("AC-1: 이름이 빈 값이면 '이름을 입력해주세요' help가 표시되고 저장되지 않는다", () => {
    renderSheet();

    fireEvent.click(submitButton());

    expect(screen.getByRole("alert").textContent).toBe("이름을 입력해주세요");
    expect(mockSaveTask).not.toHaveBeenCalled();
  });

  it("AC-1: 이름이 17자 이상이면 '16자까지 입력할 수 있어요' help가 표시되고 저장되지 않는다", () => {
    renderSheet();

    fireEvent.change(screen.getByPlaceholderText("예: 설거지"), {
      target: { value: "가나다라마바사아자차카타파하거너" }, // 17자
    });
    fireEvent.click(submitButton());

    expect(screen.getByRole("alert").textContent).toBe("16자까지 입력할 수 있어요");
    expect(mockSaveTask).not.toHaveBeenCalled();
  });

  it("AC-2: 벌금액 150 입력 시 '벌금은 100원 단위로 입력해주세요' help가 표시되고 저장되지 않는다", () => {
    renderSheet();

    fillValidName();
    fireEvent.change(screen.getByPlaceholderText("예: 500"), { target: { value: "150" } });
    fireEvent.click(submitButton());

    expect(screen.getByRole("alert").textContent).toBe("벌금은 100원 단위로 입력해주세요");
    expect(mockSaveTask).not.toHaveBeenCalled();
  });

  it("AC-2: 벌금액 10001 입력 시 '벌금은 10,000원까지 입력할 수 있어요' help가 표시되고 저장되지 않는다", () => {
    renderSheet();

    fillValidName();
    fireEvent.change(screen.getByPlaceholderText("예: 500"), { target: { value: "10001" } });
    fireEvent.click(submitButton());

    expect(screen.getByRole("alert").textContent).toBe("벌금은 10,000원까지 입력할 수 있어요");
    expect(mockSaveTask).not.toHaveBeenCalled();
  });

  it("AC-3: 난이도 Chip은 항상 1개만 selected이고, 요일은 복수 선택 결과가 오름차순 repeatDays로 저장된다", () => {
    renderSheet();

    fillValidName();

    fireEvent.click(screen.getByRole("button", { name: "어려움" }));
    fireEvent.click(screen.getByRole("button", { name: "쉬움" }));
    expect(screen.getByRole("button", { name: "쉬움" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "어려움" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "보통" })).toHaveAttribute("aria-pressed", "false");

    // 클릭 순서: 화(2) → 일(0) → 수(3) — 저장 결과는 오름차순이어야 한다
    fireEvent.click(screen.getByRole("button", { name: "화" }));
    fireEvent.click(screen.getByRole("button", { name: "일" }));
    fireEvent.click(screen.getByRole("button", { name: "수" }));

    fireEvent.click(submitButton());

    expect(mockSaveTask).toHaveBeenCalledTimes(1);
    const saved = mockSaveTask.mock.calls[0][0] as ChoreTask;
    expect(saved.difficulty).toBe(1);
    expect(saved.repeatDays).toEqual([0, 2, 3]);
  });

  it("AC-4: 담당자에서 '공동'을 선택하면 assigneeId가 null로 저장된다", () => {
    renderSheet();

    fillValidName();
    fireEvent.click(screen.getByRole("button", { name: "공동" }));
    fireEvent.click(submitButton());

    expect(mockSaveTask).toHaveBeenCalledTimes(1);
    const saved = mockSaveTask.mock.calls[0][0] as ChoreTask;
    expect(saved.assigneeId).toBeNull();
  });

  it("AC-5: 저장 성공 시 saveTask 호출 + 시트가 닫히고(onClose) haptic success가 호출된다", () => {
    const { onClose } = renderSheet();

    fillValidName();
    fireEvent.click(submitButton());

    expect(mockSaveTask).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
  });
});
