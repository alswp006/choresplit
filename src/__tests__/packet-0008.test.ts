/**
 * Packet 0008 Tests: 홈(오늘 체크인) / (S2)
 *
 * Tests for src/pages/Home.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: member chip tap flips selected immediately, shows toast, fires tickWeak haptic
 * - AC-2: save failure rolls back the chip to its pre-tap state + error toast
 * - AC-3: zero check-ins today renders data-testid="today-empty" + copy
 * - AC-4: zero active chores renders EmptyState + action navigates to /chores
 * - AC-5: today-selected shows no future-day chip; >50 active chores are windowed (≤20 initial rows)
 *
 * useAppState() is mocked at "@/lib/store" (the project's actual state path —
 * NOT "@/state/AppStateContext", which this project does not use). Unlike
 * Onboarding's test, toggleCheckIn here is a plain vi.fn() that does NOT mutate
 * storeRef.state — this forces Home.tsx to hold genuine local optimistic UI
 * state (per the packet's "낙관적 토글 + 실패 시 롤백" requirement) rather than
 * merely re-deriving "selected" from the mocked store, which would never move.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";

import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { todayKST } from "@/lib/storage";
import type { ChoreSplitState, Chore, Member, CheckIn } from "@/lib/types";

mockAll();

// ── Mock @/lib/store (this project's real state path) ──
const { storeRef } = vi.hoisted(() => ({
  storeRef: {
    ready: true as boolean,
    state: {} as any,
    error: null as string | null,
    unlocked: {} as Record<string, true>,
    toggleCheckIn: vi.fn() as any,
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
const ROOMMATE: Member = {
  id: "m_2",
  name: "지은",
  colorToken: "green",
  isMe: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const DISHES: Chore = {
  id: "c_1",
  name: "설거지",
  weight: 2,
  frequency: "daily",
  penaltyAmount: 500,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeState(overrides: Partial<ChoreSplitState> = {}): ChoreSplitState {
  return {
    version: 1,
    household: { id: "h_test1", name: "테스트가구", inviteCode: "ABC123", createdAt: "2026-01-01T00:00:00.000Z" },
    members: [ME, ROOMMATE],
    chores: [DISHES],
    checkIns: [],
    settings: { reminderEnabled: false, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
    settlements: [],
    ...overrides,
  };
}

beforeEach(() => {
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.unlocked = {};
  storeRef.state = makeState();
  storeRef.toggleCheckIn = vi.fn(() => ({ ok: true }));
});

// Lazily imported so the vi.mock("@/lib/store") above is in effect first.
async function loadHome() {
  const mod = await import("@/pages/Home");
  return mod.default;
}

function findChoreRow(choreName: string): HTMLElement {
  const row = screen.getAllByRole("listitem").find((r) => r.textContent?.includes(choreName));
  if (!row) throw new Error(`chore row for "${choreName}" not found`);
  return row;
}

describe("홈(오늘 체크인) / (S2)", () => {
  describe("AC-1[P0]: member chip tap toggles check-in optimistically", () => {
    it("selecting an unchecked chip flips it, shows '체크인 완료!' toast, and fires tickWeak haptic", async () => {
      const { generateHapticFeedback } = await import("@apps-in-toss/web-framework");
      const Home = await loadHome();
      renderWithRouter(React.createElement(Home));

      const row = findChoreRow("설거지");
      const chip = within(row).getByRole("button", { name: "지은" });
      expect(chip.getAttribute("aria-pressed")).toBe("false");

      fireEvent.click(chip);

      expect(chip.getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("status").textContent).toBe("체크인 완료!");
      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
      expect(storeRef.toggleCheckIn).toHaveBeenCalledWith(todayKST(), "c_1", "m_2");
    });

    it("deselecting an already-checked chip shows '체크인을 취소했어요' toast", async () => {
      const today = todayKST();
      const checkIn: CheckIn = {
        id: `${today}__c_1__m_2` as CheckIn["id"],
        date: today,
        choreId: "c_1",
        memberId: "m_2",
        weightAtLog: 2,
        createdAt: `${today}T00:00:00.000Z`,
      };
      storeRef.state = makeState({ checkIns: [checkIn] });
      const Home = await loadHome();
      renderWithRouter(React.createElement(Home));

      const row = findChoreRow("설거지");
      const chip = within(row).getByRole("button", { name: "지은" });
      expect(chip.getAttribute("aria-pressed")).toBe("true");

      fireEvent.click(chip);

      expect(chip.getAttribute("aria-pressed")).toBe("false");
      expect(screen.getByRole("status").textContent).toBe("체크인을 취소했어요");
    });
  });

  describe("AC-2[P0]: save failure rolls back the optimistic toggle", () => {
    it("reverts the chip to unselected and shows the error toast when toggleCheckIn fails", async () => {
      storeRef.toggleCheckIn = vi.fn(() => ({
        ok: false,
        error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요",
      }));
      const Home = await loadHome();
      renderWithRouter(React.createElement(Home));

      const row = findChoreRow("설거지");
      const chip = within(row).getByRole("button", { name: "지은" });

      fireEvent.click(chip);

      expect(chip.getAttribute("aria-pressed")).toBe("false");
      expect(screen.getByRole("status").textContent).toBe(
        "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요",
      );
    });
  });

  describe("AC-3: zero check-ins today renders the today-empty state", () => {
    it("shows data-testid='today-empty' with the content icon and empty copy", async () => {
      storeRef.state = makeState({ checkIns: [] });
      const Home = await loadHome();
      renderWithRouter(React.createElement(Home));

      const container = screen.getByTestId("today-empty");
      expect(within(container).getByText("오늘 첫 집안일을 기록해보세요").textContent).toBe(
        "오늘 첫 집안일을 기록해보세요",
      );
      expect(container.querySelector("[data-content-icon]")).not.toBeNull();
    });
  });

  describe("AC-4: zero active chores renders an EmptyState with a management CTA", () => {
    it("shows the empty copy and navigates to /chores with openCreate on action tap", async () => {
      storeRef.state = makeState({ chores: [], checkIns: [] });
      const Home = await loadHome();
      renderWithRouter(React.createElement(Home));

      expect(screen.getByText("집안일 항목을 먼저 추가해주세요").textContent).toBe(
        "집안일 항목을 먼저 추가해주세요",
      );

      const actionButton = screen.getAllByRole("button").find((b) => b.textContent?.includes("항목"));
      expect(actionButton).toBeDefined();
      fireEvent.click(actionButton!);

      expect(mockNavigate).toHaveBeenCalledWith("/chores", { state: { openCreate: true } });
    });
  });

  describe("AC-5: date navigation and list windowing", () => {
    it("with 오늘 selected, renders 어제/오늘 chips only — no future-day chip", async () => {
      const Home = await loadHome();
      renderWithRouter(React.createElement(Home));

      const todayChip = screen.getByRole("button", { name: "오늘" });
      expect(todayChip.getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "어제" }).textContent).toBe("어제");
      expect(screen.queryByRole("button", { name: "내일" })).toBeNull();
    });

    it("windows the active chore list to at most 20 initial DOM rows when there are 60 active chores", async () => {
      const manyChores: Chore[] = Array.from({ length: 60 }, (_, i) => ({
        id: `c_${i}`,
        name: `집안일${i}`,
        weight: 1,
        frequency: "daily",
        penaltyAmount: 0,
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      }));
      storeRef.state = makeState({ chores: manyChores, checkIns: [] });
      const Home = await loadHome();
      renderWithRouter(React.createElement(Home));

      const rows = screen.getAllByRole("listitem");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(20);
    });
  });
});
