/**
 * Packet heal-1-02 Tests: 설정 페이지 /settings 완성 (0015 재실행, 범위 축소 실행)
 *
 * Tests for src/pages/Settings.tsx (범위 축소 재검증 — TDD red-phase 계약)
 * - AC-1: 리마인더 Switch를 끄면 settings.reminderEnabled=false가 즉시 저장되고
 *   새로고침(재마운트) 후에도 꺼진 상태가 유지된다
 * - AC-2: BottomSheet에서 21시를 8시로 바꾸면 settings.reminderHour===8이 저장되고
 *   행에 '오전 8시'가 표시된다
 * - AC-3: '오래된 기록 정리' 탭 → AlertDialog 확인 시 30일 이전 checkIns만 제거되고
 *   30일 이내 기록은 보존되며 Toast '오래된 기록을 정리했어요'가 표시된다
 * - AC-4: 벌금 Switch를 끄면 settings.penaltyEnabled=false가 저장되고, /settle에서
 *   정산 제안이 비활성(EmptyState + 확정 버튼 disabled) 상태로 표시된다 (다운스트림까지 검증)
 * - AC-5: 페이지가 ScreenScaffold로 감싸이고 HEX 하드코딩·비TDS UI import가 0건이다
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path — see packet-0010).
 * pruneCheckIns(days) is the existing store action (packet-0015) — Settings.tsx must call it
 * with 30, not call storage.pruneOlderThan directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { pruneOlderThan, todayKST } from "@/lib/storage";
import { buildSettlement, getWeekStart } from "@/lib/report";
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
    updateSettings: vi.fn() as any,
    pruneCheckIns: vi.fn() as any,
    addSettlement: vi.fn() as any,
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

function makeState(overrides: Partial<ChoreSplitState> = {}): ChoreSplitState {
  return {
    version: 1,
    household: { id: "h_test1", name: "우리집", inviteCode: "AB12CD", createdAt: "2026-01-01T00:00:00.000Z" },
    members: [ME, JIMIN],
    chores: [],
    checkIns: [],
    settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
    settlements: [],
    ...overrides,
  };
}

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

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Independent reference implementation of the required hour-label algorithm.
function formatHour(h: number): string {
  const period = h < 12 ? "오전" : "오후";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${display}시`;
}

const THIS_WEEK_START = getWeekStart(todayKST());

beforeEach(() => {
  mockLocation.state = null;
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.unlocked = {};
  storeRef.unlock = vi.fn();
  // updateSettings mimics the real store.ts contract: patches settings on the state object
  // in place so a subsequent (simulated) "refresh" render reads the persisted value.
  storeRef.updateSettings = vi.fn((patch: Record<string, unknown>) => {
    storeRef.state = { ...storeRef.state, settings: { ...storeRef.state.settings, ...patch } };
    return { ok: true };
  });
  storeRef.pruneCheckIns = vi.fn((days: number) => {
    storeRef.state = { ...storeRef.state, checkIns: pruneOlderThan(storeRef.state, days).checkIns };
    return { ok: true };
  });
  storeRef.addSettlement = vi.fn(() => ({ ok: true }));
  storeRef.state = makeState();
});

// Lazily imported so vi.mock("@/lib/store") above is in effect first.
async function loadSettings() {
  const mod = await import("@/pages/Settings");
  return mod.default;
}

async function loadSettle() {
  const mod = await import("@/pages/Settle");
  return mod.default;
}

describe("설정 페이지 /settings 완성 (0015 재실행, 범위 축소 실행)", () => {
  describe("AC-1[P0]: reminder switch off saves immediately and persists across a simulated refresh", () => {
    it("calls updateSettings({reminderEnabled:false}) on toggle, and a fresh mount reflects it unchecked", async () => {
      const Settings = await loadSettings();
      const { unmount } = renderWithRouter(React.createElement(Settings));

      const toggle = within(screen.getByTestId("settings-reminder-toggle")).getByRole("switch");
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      expect(storeRef.updateSettings).toHaveBeenCalledWith({ reminderEnabled: false });
      expect(storeRef.state.settings.reminderEnabled).toBe(false);

      unmount();

      renderWithRouter(React.createElement(Settings));
      const toggleAfterRefresh = within(screen.getByTestId("settings-reminder-toggle")).getByRole(
        "switch",
      );
      expect(toggleAfterRefresh).not.toBeChecked();
    });

    it("[error path] surfaces a Toast when the store reports a save failure", async () => {
      storeRef.updateSettings = vi.fn(() => ({ ok: false, error: "저장 공간이 부족해요" }));
      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      const toggle = within(screen.getByTestId("settings-reminder-toggle")).getByRole("switch");
      fireEvent.click(toggle);

      expect(screen.getByText("저장 공간이 부족해요")).toBeInTheDocument();
    });
  });

  describe("AC-2[P0]: hour BottomSheet 21시 → 8시 saves reminderHour and updates the row label", () => {
    it("selecting '오전 8시' calls updateSettings({reminderHour:8}); the row label updates to '오전 8시'", async () => {
      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      expect(screen.getByTestId("settings-hour-row").textContent).toContain(formatHour(21));

      fireEvent.click(screen.getByTestId("settings-hour-row"));
      const dialog = screen.getByRole("dialog");
      const option = within(dialog).getByRole("button", { name: formatHour(8) });

      fireEvent.click(option);

      expect(storeRef.updateSettings).toHaveBeenCalledWith({ reminderHour: 8 });
      expect(storeRef.state.settings.reminderHour).toBe(8);
      expect(screen.getByTestId("settings-hour-row").textContent).toContain("오전 8시");
    });
  });

  describe("AC-3[P0]: cleanup confirm removes only check-ins older than 30 days + shows Toast", () => {
    it("keeps a 29-day-old check-in and removes a 31-day-old one, then toasts", async () => {
      const today = todayKST();
      const oldCheckIn = makeCheckIn(addDays(today, -31), "c_1", "m_me", 0);
      const recentCheckIn = makeCheckIn(addDays(today, -29), "c_1", "m_me", 1);
      storeRef.state = makeState({ checkIns: [oldCheckIn, recentCheckIn] });

      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      fireEvent.click(screen.getByTestId("settings-cleanup-row"));
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(storeRef.pruneCheckIns).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "정리" }));

      expect(storeRef.pruneCheckIns).toHaveBeenCalledWith(30);
      expect(storeRef.state.checkIns).toHaveLength(1);
      expect(storeRef.state.checkIns[0].id).toBe(recentCheckIn.id);
      expect(screen.getByText("오래된 기록을 정리했어요")).toBeInTheDocument();
    });

    it("the AlertDialog exposes a left '닫기' button that cancels without pruning", async () => {
      storeRef.state = makeState({
        checkIns: [makeCheckIn(addDays(todayKST(), -31), "c_1", "m_me", 0)],
      });
      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      fireEvent.click(screen.getByTestId("settings-cleanup-row"));
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));

      expect(storeRef.pruneCheckIns).not.toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  describe("AC-4[P0]: penalty switch off saves penaltyEnabled=false and disables /settle downstream", () => {
    it("calls updateSettings({penaltyEnabled:false}) when the penalty switch is toggled off", async () => {
      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      const toggle = within(screen.getByTestId("settings-penalty-toggle")).getByRole("switch");
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      expect(storeRef.updateSettings).toHaveBeenCalledWith({ penaltyEnabled: false });
      expect(storeRef.state.settings.penaltyEnabled).toBe(false);
    });

    it("[downstream] with penaltyEnabled=false, /settle shows EmptyState and disables the confirm CTA even with unpaid chores", async () => {
      const chore = makeChore({ id: "c_1", name: "설거지", penaltyAmount: 1000 });
      const checkIns = [0, 1, 2].map((d, i) => makeCheckIn(addDays(THIS_WEEK_START, d), "c_1", "m_me", i));
      const stateWithPenalty = makeState({ chores: [chore], checkIns });
      const expected = buildSettlement(stateWithPenalty, THIS_WEEK_START);
      expect(expected.totalPenalty).toBeGreaterThan(0);

      storeRef.state = {
        ...stateWithPenalty,
        settings: { ...stateWithPenalty.settings, penaltyEnabled: false },
      };
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      expect(screen.getByText("이번 주는 정산할 벌금이 없어요")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "정산 확정" })).toBeDisabled();
    });
  });

  describe("AC-5[P0]: page uses ScreenScaffold, zero HEX literals, TDS-only UI imports", () => {
    it("wraps content in the PageShell root (ScreenScaffold) and renders the FloatingTabBar", async () => {
      const Settings = await loadSettings();
      const { container } = renderWithRouter(React.createElement(Settings));

      // PageShell always sets minHeight: "100dvh" on its root div — a ScreenScaffold fingerprint.
      const root = container.firstElementChild as HTMLElement;
      expect(root.style.minHeight).toBe("100dvh");
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("source has zero raw HEX color literals and imports UI only from @toss/tds-mobile / local components", () => {
      const settingsPath = fileURLToPath(new URL("../pages/Settings.tsx", import.meta.url));
      const source = readFileSync(settingsPath, "utf-8");

      expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);

      const importLines = source.match(/^import .*from ["'][^"']+["'];?$/gm) ?? [];
      const forbidden = importLines.filter((line) =>
        /from ["'](react-bootstrap|antd|@mui|@chakra-ui|@radix-ui|tailwindcss)/.test(line),
      );
      expect(forbidden).toEqual([]);
    });
  });

  describe("Routing: App.tsx wires /settings", () => {
    it("registers a Route for /settings so FloatingTabBar's '설정' tab resolves", () => {
      const appPath = fileURLToPath(new URL("../App.tsx", import.meta.url));
      const source = readFileSync(appPath, "utf-8");
      expect(/path=["']\/settings["']/.test(source)).toBe(true);
    });
  });
});
