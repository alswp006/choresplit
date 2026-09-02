import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/types";
import Onboarding from "@/pages/Onboarding";

/**
 * PACKET 0010: src/pages/Onboarding.tsx — 온보딩 화면 /onboarding
 *
 * Expected export from src/pages/Onboarding.tsx (NOT YET IMPLEMENTED — red phase):
 *   export default function Onboarding(): JSX.Element
 *
 * On submit ("시작하기"): validates all member names (non-empty, no duplicates within
 * the household), and if valid calls the real repository functions directly
 * (src/storage/repository.ts — createHousehold(name, memberNames), seedDefaultTasks(),
 * saveSettings({...})) which write straight to localStorage, then navigate('/', { replace: true }).
 * If invalid: shows inline TextField hasError + help (role="alert") on the offending
 * member row(s), does NOT write to storage, does NOT navigate.
 *
 * UI contract used by these tests:
 * - Household name TextField: placeholder="예: 우리집" (query via getByPlaceholderText)
 * - Member name TextField (one per row, 2 rows shown by default): placeholder="이름을 입력해주세요"
 *   (query via getAllByPlaceholderText)
 * - "구성원 추가" button (role="button", name="구성원 추가") appends a row, up to MAX_MEMBERS(4).
 *   At 4 members it becomes disabled and the copy "구성원은 최대 4명까지 등록할 수 있어요" is shown.
 * - Each member row (beyond the first) has a delete button: role="button", name="구성원 삭제"
 * - Submit: SubmitFooter, role="button", name="시작하기". disabled/loading while submitting
 *   (blocks a second click from firing the handler again).
 */

mockAll();

function renderPage() {
  return renderWithRouter(React.createElement(Onboarding));
}

function fillHouseholdName(value = "우리집") {
  fireEvent.change(screen.getByPlaceholderText("예: 우리집"), { target: { value } });
}

function memberNameInputs() {
  return screen.getAllByPlaceholderText("이름을 입력해주세요");
}

function fillValidTwoMembers() {
  fillHouseholdName();
  const inputs = memberNameInputs();
  fireEvent.change(inputs[0], { target: { value: "민지" } });
  fireEvent.change(inputs[1], { target: { value: "현우" } });
}

function submitButton() {
  return screen.getByRole("button", { name: "시작하기" });
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe("온보딩 화면 /onboarding", () => {
  it("AC-1[P0]: 저장 성공 시 household(구성원 2명, targetShare 0.5)/tasks(기본 6개)/settings가 정확히 저장된다", () => {
    renderPage();

    fillValidTwoMembers();
    fireEvent.click(submitButton());

    const household = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEHOLD)!);
    expect(household.name).toBe("우리집");
    expect(household.members).toHaveLength(2);
    expect(household.members.map((m: { name: string }) => m.name)).toEqual(["민지", "현우"]);
    expect(household.members[0].targetShare).toBe(0.5);
    expect(household.members[1].targetShare).toBe(0.5);

    const tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)!);
    expect(tasks).toHaveLength(6);
    expect(tasks.map((t: { name: string }) => t.name)).toEqual([
      "설거지",
      "청소",
      "빨래",
      "분리수거",
      "요리",
      "화장실청소",
    ]);

    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)!);
    expect(settings.onboardingDone).toBe(true);
    expect(settings.activeMemberId).toBe(household.members[0].id);
  });

  it("AC-1[P0]: 구성원 이름 검증 실패 시 household/tasks/settings 저장이 전혀 수행되지 않는다", () => {
    renderPage();

    fillHouseholdName();
    const inputs = memberNameInputs();
    fireEvent.change(inputs[0], { target: { value: "" } });
    fireEvent.change(inputs[1], { target: { value: "현우" } });
    fireEvent.click(submitButton());

    expect(localStorage.getItem(STORAGE_KEYS.HOUSEHOLD)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.TASKS)).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-2[P0]: 저장 성공 후 navigate('/', { replace: true })가 정확히 1회 호출된다", () => {
    renderPage();

    fillValidTwoMembers();
    fireEvent.click(submitButton());

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("AC-3: 구성원 이름이 빈 값이면 해당 행에 '이름을 입력해주세요' help가 표시된다", () => {
    renderPage();

    fillHouseholdName();
    const inputs = memberNameInputs();
    fireEvent.change(inputs[0], { target: { value: "" } });
    fireEvent.change(inputs[1], { target: { value: "현우" } });
    fireEvent.click(submitButton());

    const alertTexts = screen.getAllByRole("alert").map((el) => el.textContent);
    expect(alertTexts).toContain("이름을 입력해주세요");
    expect(localStorage.getItem(STORAGE_KEYS.HOUSEHOLD)).toBeNull();
  });

  it("AC-3: 구성원 이름이 서로 같으면 '이름이 중복돼요' help가 표시되고 저장되지 않는다", () => {
    renderPage();

    fillHouseholdName();
    const inputs = memberNameInputs();
    fireEvent.change(inputs[0], { target: { value: "민지" } });
    fireEvent.change(inputs[1], { target: { value: "민지" } });
    fireEvent.click(submitButton());

    const alertTexts = screen.getAllByRole("alert").map((el) => el.textContent);
    expect(alertTexts).toContain("이름이 중복돼요");
    expect(localStorage.getItem(STORAGE_KEYS.HOUSEHOLD)).toBeNull();
  });

  it("AC-4: 구성원이 4명이 되면 '구성원 추가' 버튼이 disabled되고 안내 문구가 표시된다", () => {
    renderPage();

    const addButton = () => screen.getByRole("button", { name: "구성원 추가" });
    fireEvent.click(addButton());
    fireEvent.click(addButton());

    expect(memberNameInputs()).toHaveLength(4);
    expect(addButton()).toBeDisabled();
    expect(screen.getByText("구성원은 최대 4명까지 등록할 수 있어요")).toBeInTheDocument();
  });

  it("AC-5: 저장 중에는 '시작하기' 버튼이 disabled되어 두 번째 클릭이 추가 저장/navigate를 일으키지 않는다", () => {
    renderPage();

    fillValidTwoMembers();
    const button = submitButton();
    fireEvent.click(button);

    expect(button).toBeDisabled();
    const firstHouseholdId = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEHOLD)!).id;

    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const household = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEHOLD)!);
    expect(household.id).toBe(firstHouseholdId);
  });
});
