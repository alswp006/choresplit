/**
 * Packet 0010 Tests: 동거인 관리 /members (S4)
 *
 * Tests for src/pages/Members.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: invite code (/^[A-Z0-9]{6}$/) shown + copy button → clipboard + Toast, no outlink
 * - AC-2: 4 members → add attempt shows inline cap error, list count unchanged
 * - AC-3: duplicate name → inline '같은 이름이 이미 있어요'
 * - AC-4: isMe delete is blocked (disabled, or click → toast + member kept)
 * - AC-5: other-member delete confirm dialog shows checkIn count; confirm removes member + checkIns
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path).
 * addMember/removeMember delegate to the REAL @/lib/household implementations so
 * AC-2/AC-4/AC-5's validation-message assertions exercise actual business logic.
 * AC-3's duplicate-name check does not exist yet in household.ts — this test is
 * expected to drive that addition.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";

import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { setClipboardText } from "@apps-in-toss/web-framework";
import {
  addMember as addMemberImpl,
  removeMember as removeMemberImpl,
  countMemberCheckIns,
} from "@/lib/household";
import type { ChoreSplitState, Member, CheckIn } from "@/lib/types";

mockAll();

// ── Mock @/lib/store (this project's real state path) ──
const { storeRef } = vi.hoisted(() => ({
  storeRef: {
    ready: true as boolean,
    state: {} as any,
    error: null as string | null,
    addMember: vi.fn() as any,
    removeMember: vi.fn() as any,
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

function makeCheckIn(id: string, memberId: string): CheckIn {
  return {
    id: id as CheckIn["id"],
    date: "2026-01-05",
    choreId: "c_1",
    memberId,
    weightAtLog: 2,
    createdAt: "2026-01-05T00:00:00.000Z",
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

beforeEach(() => {
  mockLocation.state = null;
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.state = makeState();
  storeRef.addMember = vi.fn((name: string) => addMemberImpl(storeRef.state, name));
  storeRef.removeMember = vi.fn((memberId: string) => removeMemberImpl(storeRef.state, memberId));
});

// Lazily imported so vi.mock("@/lib/store") above is in effect first.
async function loadMembers() {
  const mod = await import("@/pages/Members");
  return mod.default;
}

function findRow(name: string): HTMLElement {
  const row = screen.getAllByRole("listitem").find((r) => r.textContent?.includes(name));
  if (!row) throw new Error(`${name} row not found`);
  return row;
}

function openAddSheet() {
  fireEvent.click(screen.getByRole("button", { name: /동거인 추가|추가/ }));
  return screen.getByRole("dialog");
}

describe("동거인 관리 /members (S4)", () => {
  describe("AC-1[P0]: invite code display + copy", () => {
    it("shows the invite code matching /^[A-Z0-9]{6}$/ and copies it via SDK on button tap", async () => {
      const Members = await loadMembers();
      renderWithRouter(React.createElement(Members));

      expect(screen.getByText("AB12CD")).toBeInTheDocument();
      expect("AB12CD").toMatch(/^[A-Z0-9]{6}$/);

      fireEvent.click(screen.getByRole("button", { name: /복사/ }));

      expect(setClipboardText).toHaveBeenCalledWith("AB12CD");
      expect(screen.getByText("초대 코드를 복사했어요")).toBeInTheDocument();
    });

    it("does not navigate away or change route when copying (no outlink)", async () => {
      const Members = await loadMembers();
      renderWithRouter(React.createElement(Members));

      fireEvent.click(screen.getByRole("button", { name: /복사/ }));

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("AC-2[P0]: 4-member cap shows inline error", () => {
    it("shows '동거인은 최대 4명까지 등록할 수 있어요' and keeps the list at 4 members", async () => {
      storeRef.state = makeState({
        members: [
          ME,
          JIMIN,
          { id: "m_3", name: "하늘", colorToken: "orange", isMe: false, createdAt: "2026-01-03T00:00:00.000Z" },
          { id: "m_4", name: "서준", colorToken: "purple", isMe: false, createdAt: "2026-01-04T00:00:00.000Z" },
        ],
      });
      const Members = await loadMembers();
      renderWithRouter(React.createElement(Members));

      const dialog = openAddSheet();
      fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "유진" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "추가하기" }));

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("동거인은 최대 4명까지 등록할 수 있어요");
      expect(storeRef.state.members.length).toBe(4);
    });
  });

  describe("AC-3: duplicate name shows inline error", () => {
    it("shows '같은 이름이 이미 있어요' and does not add a new member", async () => {
      const Members = await loadMembers();
      renderWithRouter(React.createElement(Members));

      const dialog = openAddSheet();
      fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "지민" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "추가하기" }));

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("같은 이름이 이미 있어요");
      expect(storeRef.state.members.length).toBe(2);
    });
  });

  describe("AC-4[P0]: isMe deletion is blocked", () => {
    it("blocks deleting the isMe member: disabled button, or click keeps the member and shows a toast", async () => {
      const Members = await loadMembers();
      renderWithRouter(React.createElement(Members));

      const meRow = findRow("민수");
      const deleteBtn = within(meRow).getByRole("button", { name: "삭제" }) as HTMLButtonElement;

      if (deleteBtn.disabled) {
        expect(deleteBtn.disabled).toBe(true);
      } else {
        fireEvent.click(deleteBtn);
        expect(screen.getByText("본인은 삭제할 수 없어요")).toBeInTheDocument();
      }

      expect(storeRef.state.members.some((m: Member) => m.id === "m_me")).toBe(true);
      expect(storeRef.state.members.length).toBe(2);
    });
  });

  describe("AC-5[P0]: other-member deletion requires confirmation with checkIn count", () => {
    it("shows the exact checkIn count in the confirm dialog and removes member + checkIns on confirm", async () => {
      const checkIns: CheckIn[] = [
        makeCheckIn("2026-01-01__c_1__m_2", "m_2"),
        makeCheckIn("2026-01-02__c_1__m_2", "m_2"),
        makeCheckIn("2026-01-03__c_1__m_2", "m_2"),
        makeCheckIn("2026-01-04__c_1__m_2", "m_2"),
        makeCheckIn("2026-01-05__c_1__m_2", "m_2"),
        makeCheckIn("2026-01-06__c_1__m_me", "m_me"),
      ];
      storeRef.state = makeState({ checkIns });
      expect(countMemberCheckIns(storeRef.state, "m_2")).toBe(5);

      const Members = await loadMembers();
      renderWithRouter(React.createElement(Members));

      const jiminRow = findRow("지민");
      fireEvent.click(within(jiminRow).getByRole("button", { name: "삭제" }));

      const dialog = screen.getByRole("alertdialog");
      expect(dialog.textContent).toContain("기록 5건이 함께 지워져요");

      fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

      expect(storeRef.removeMember).toHaveBeenCalledWith("m_2");
      expect(storeRef.state.members.some((m: Member) => m.id === "m_2")).toBe(false);
      expect(storeRef.state.checkIns.filter((c: CheckIn) => c.memberId === "m_2").length).toBe(0);
      expect(storeRef.state.checkIns.length).toBe(1);
    });

    it("does not remove the member when the dialog is dismissed without confirming", async () => {
      storeRef.state = makeState({ checkIns: [makeCheckIn("2026-01-01__c_1__m_2", "m_2")] });
      const Members = await loadMembers();
      renderWithRouter(React.createElement(Members));

      const jiminRow = findRow("지민");
      fireEvent.click(within(jiminRow).getByRole("button", { name: "삭제" }));
      expect(screen.getByRole("alertdialog")).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "닫기" }));

      expect(storeRef.removeMember).not.toHaveBeenCalled();
      expect(storeRef.state.members.length).toBe(2);
    });
  });
});
