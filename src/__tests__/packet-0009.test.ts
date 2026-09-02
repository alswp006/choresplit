/**
 * Packet 0009 Tests: 집안일 항목 관리 /chores (S3)
 *
 * Tests for src/pages/Chores.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: location.state.openCreate === true (after null-check) auto-opens the BottomSheet
 * - AC-2: duplicate chore name → inline TextField error, list count unchanged
 * - AC-3: penalty 7000 → range error; penalty 550 → 100원 unit error, both inline
 * - AC-4: Switch toggle keeps the chore in the list, excluded from home check-ins,
 *         existing checkIns untouched
 * - AC-5: 0 chores → EmptyState + add CTA; penalty TextField is inputMode="numeric"
 *         and scrolls into view on focus
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path).
 * addChore delegates to the REAL @/lib/household addChore so AC-2/AC-3's
 * validation-message assertions exercise actual business logic, not a stub.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";

import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { addChore as addChoreImpl, type AddChoreInput } from "@/lib/household";
import type { ChoreSplitState, Chore, Member, CheckIn } from "@/lib/types";

mockAll();

// ── Mock @/lib/store (this project's real state path) ──
const { storeRef } = vi.hoisted(() => ({
  storeRef: {
    ready: true as boolean,
    state: {} as any,
    error: null as string | null,
    addChore: vi.fn() as any,
    toggleChoreActive: vi.fn() as any,
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
    members: [ME],
    chores: [DISHES],
    checkIns: [],
    settings: { reminderEnabled: false, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
    settlements: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockLocation.state = null;
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.state = makeState();
  storeRef.addChore = vi.fn((input: AddChoreInput) => addChoreImpl(storeRef.state, input));
  storeRef.toggleChoreActive = vi.fn((choreId: string) => {
    const chore = storeRef.state.chores.find((c: Chore) => c.id === choreId);
    if (chore) chore.active = !chore.active;
    return { ok: true };
  });
});

// Lazily imported so the vi.mock("@/lib/store") above is in effect first.
async function loadChores() {
  const mod = await import("@/pages/Chores");
  return mod.default;
}

function openSheetViaCTA() {
  fireEvent.click(screen.getByRole("button", { name: "항목 추가" }));
  return screen.getByRole("dialog");
}

describe("집안일 항목 관리 /chores (S3)", () => {
  describe("AC-1: location.state.openCreate auto-opens the sheet", () => {
    it("opens the BottomSheet form immediately when location.state.openCreate is true", async () => {
      mockLocation.state = { openCreate: true } as any;
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));

      const dialog = screen.getByRole("dialog");
      expect(dialog).not.toBeNull();
      expect(within(dialog).getByPlaceholderText("설거지")).toBeInTheDocument();
      expect(within(dialog).getByPlaceholderText("500")).toBeInTheDocument();
    });

    it("does not open the sheet when location.state is null or openCreate is missing", async () => {
      mockLocation.state = null;
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));
      expect(screen.queryByRole("dialog")).toBeNull();

      mockLocation.state = { openCreate: false } as any;
      renderWithRouter(React.createElement(Chores));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("AC-2: duplicate chore name shows an inline error", () => {
    it("shows hasError help='이미 있는 항목이에요' and does not change the list count", async () => {
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));

      const dialog = openSheetViaCTA();
      fireEvent.change(within(dialog).getByPlaceholderText("설거지"), { target: { value: "설거지" } });
      fireEvent.change(within(dialog).getByPlaceholderText("500"), { target: { value: "0" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "추가하기" }));

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("이미 있는 항목이에요");
      expect(screen.getAllByRole("listitem").length).toBe(1);
      expect(storeRef.state.chores.length).toBe(1);
    });
  });

  describe("AC-3: penalty amount validation shows inline errors", () => {
    it("shows '벌금은 0원~5,000원 사이여야 해요' when penalty is 7000", async () => {
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));

      const dialog = openSheetViaCTA();
      fireEvent.change(within(dialog).getByPlaceholderText("설거지"), { target: { value: "새운동" } });
      fireEvent.change(within(dialog).getByPlaceholderText("500"), { target: { value: "7000" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "추가하기" }));

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("벌금은 0원~5,000원 사이여야 해요");
      expect(storeRef.state.chores.length).toBe(1);
    });

    it("shows '벌금은 100원 단위로 입력해주세요' when penalty is 550", async () => {
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));

      const dialog = openSheetViaCTA();
      fireEvent.change(within(dialog).getByPlaceholderText("설거지"), { target: { value: "새운동2" } });
      fireEvent.change(within(dialog).getByPlaceholderText("500"), { target: { value: "550" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "추가하기" }));

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("벌금은 100원 단위로 입력해주세요");
      expect(storeRef.state.chores.length).toBe(1);
    });
  });

  describe("AC-4: Switch toggle deactivates without removing or touching checkIns", () => {
    it("keeps the chore listed, flips active via toggleChoreActive, and leaves checkIns count unchanged", async () => {
      const checkIn: CheckIn = {
        id: "2026-01-05__c_1__m_me" as CheckIn["id"],
        date: "2026-01-05",
        choreId: "c_1",
        memberId: "m_me",
        weightAtLog: 2,
        createdAt: "2026-01-05T00:00:00.000Z",
      };
      storeRef.state = makeState({ chores: [{ ...DISHES }], checkIns: [checkIn] });
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));

      const row = screen.getAllByRole("listitem").find((r) => r.textContent?.includes("설거지"));
      if (!row) throw new Error("설거지 row not found");
      const toggle = within(row).getByRole("switch") as HTMLInputElement;
      expect(toggle.checked).toBe(true);

      fireEvent.click(toggle);

      expect(storeRef.toggleChoreActive).toHaveBeenCalledWith("c_1");
      expect(screen.getAllByRole("listitem").length).toBe(1);
      expect(storeRef.state.checkIns.length).toBe(1);
    });
  });

  describe("AC-5: zero chores renders EmptyState; penalty field is numeric + auto-scrolls", () => {
    it("renders an EmptyState with an add CTA when there are 0 chores, and the CTA opens the sheet", async () => {
      storeRef.state = makeState({ chores: [] });
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));

      expect(screen.getAllByRole("listitem").length).toBe(0);
      const emptyCta = screen.getAllByRole("button").find((b) => b.textContent?.includes("추가"));
      expect(emptyCta).toBeDefined();

      fireEvent.click(emptyCta!);
      expect(screen.getByRole("dialog")).not.toBeNull();
    });

    it("gives the penalty TextField inputMode='numeric' and scrolls it into view on focus", async () => {
      const scrollSpy = vi.fn();
      (HTMLElement.prototype as any).scrollIntoView = scrollSpy;

      mockLocation.state = { openCreate: true } as any;
      const Chores = await loadChores();
      renderWithRouter(React.createElement(Chores));

      const dialog = screen.getByRole("dialog");
      const penaltyInput = within(dialog).getByPlaceholderText("500");
      expect(penaltyInput.getAttribute("inputmode")).toBe("numeric");

      fireEvent.focus(penaltyInput);
      expect(scrollSpy).toHaveBeenCalledWith({ block: "center" });
    });
  });
});
