/**
 * Packet 0015 Tests: 설정 /settings (S9)
 *
 * Tests for src/pages/Settings.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: 리마인더 Switch를 끄면 settings.reminderEnabled=false가 즉시 저장되고
 *   새로고침 후에도 꺼진 상태가 유지된다
 * - AC-2: 시간 선택 BottomSheet에서 21시를 8시로 변경하면 settings.reminderHour===8이
 *   저장되고 목록 행에 '오전 8시'가 표시된다
 * - AC-3: '오래된 기록 정리' 탭 → AlertDialog(왼쪽 '닫기') 확인 시 30일 이전 checkIns가
 *   제거되고 Toast '오래된 기록을 정리했어요'가 표시되며 30일 이내 기록은 보존된다
 * - AC-4: 벌금 Switch를 끄면 settings.penaltyEnabled=false가 저장된다 (다운스트림 /settle
 *   비활성 표시는 packet-0013의 Settle 테스트가 이미 검증함 — 여기선 저장 호출만 확인)
 * - AC-5: 외부 링크/앱 설치 유도 문구가 0건이고, 커스텀 터치 타깃(스위치 행)이 44px 이상이다
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path — see packet-0010).
 * pruneCheckIns is a NEW store action this packet introduces (mirrors addSettlement's shape
 * from packet-0013: mutate + persist, return ActionResult) — Settings.tsx calls it with the
 * cutoff day count (30), it does not call pruneOlderThan directly.
 *
 * Implementation contract (testIds/labels the Coder MUST use — see assertions below):
 * - reminder toggle: wrapped in <div data-testid="settings-reminder-toggle" style={{ minHeight: 44 }}>
 *   containing a <Switch checked={settings.reminderEnabled} onChange={...} /> that calls
 *   updateSettings({ reminderEnabled: !settings.reminderEnabled }) on change (official TDS
 *   Switch pattern: onChange takes no arg, toggle current value — see tds-essential.txt).
 * - penalty toggle: same shape, data-testid="settings-penalty-toggle", patches penaltyEnabled.
 * - hour row: a ListRow (or equivalent) with data-testid="settings-hour-row" and onClick that
 *   opens the BottomSheet. Row must render the formatted current hour text (see formatHour below)
 *   somewhere in its content.
 * - hour BottomSheet: renders 24 option buttons (role="button"), one per hour 0~23, accessible
 *   name === formatHour(hour) (e.g. "오전 8시"), each with data-testid={`hour-option-${hour}`}
 *   and inline style minHeight: 44. Clicking an option calls updateSettings({ reminderHour: hour }).
 * - cleanup row: data-testid="settings-cleanup-row", onClick opens an AlertDialog (role="alertdialog").
 *   The mocked AlertDialog auto-renders a "닫기" close button; the page must ALSO pass an
 *   alertButton with the text "정리" that calls pruneCheckIns(30) then shows a Toast with the
 *   exact text "오래된 기록을 정리했어요".
 * - formatHour(h): period = h < 12 ? "오전" : "오후"; display = h % 12 === 0 ? 12 : h % 12;
 *   returns `${period} ${display}시` (e.g. 0 → "오전 12시", 8 → "오전 8시", 12 → "오후 12시",
 *   21 → "오후 9시"). This exact algorithm is required so the AC-2 assertion below matches.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { pruneOlderThan, todayKST } from "@/lib/storage";
import type { ChoreSplitState, Member, CheckIn } from "@/lib/types";

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

function makeState(overrides: Partial<ChoreSplitState> = {}): ChoreSplitState {
  return {
    version: 1,
    household: { id: "h_test1", name: "우리집", inviteCode: "AB12CD", createdAt: "2026-01-01T00:00:00.000Z" },
    members: [ME],
    chores: [],
    checkIns: [],
    settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
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

// Independent reference implementation of the required label algorithm (see contract above).
function formatHour(h: number): string {
  const period = h < 12 ? "오전" : "오후";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${display}시`;
}

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
  storeRef.pruneCheckIns = vi.fn(() => ({ ok: true }));
  storeRef.state = makeState();
});

// Lazily imported so vi.mock("@/lib/store") above is in effect first.
async function loadSettings() {
  const mod = await import("@/pages/Settings");
  return mod.default;
}

describe("설정 /settings (S9)", () => {
  describe("AC-1: reminder switch off saves immediately and persists across a simulated refresh", () => {
    it("calls updateSettings({reminderEnabled:false}) on toggle, and a fresh mount reflects it unchecked", async () => {
      const Settings = await loadSettings();
      const { unmount } = renderWithRouter(React.createElement(Settings));

      const toggle = within(screen.getByTestId("settings-reminder-toggle")).getByRole("switch");
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      expect(storeRef.updateSettings).toHaveBeenCalledWith({ reminderEnabled: false });
      expect(storeRef.state.settings.reminderEnabled).toBe(false);

      unmount();

      // Simulated refresh: a brand-new mount reading the persisted (mutated) state.
      renderWithRouter(React.createElement(Settings));
      const toggleAfterRefresh = within(screen.getByTestId("settings-reminder-toggle")).getByRole(
        "switch",
      );
      expect(toggleAfterRefresh).not.toBeChecked();
    });
  });

  describe("AC-2: hour BottomSheet 21시 → 8시 saves reminderHour and updates the row label", () => {
    it("selecting '오전 8시' calls updateSettings({reminderHour:8}); a fresh mount shows '오전 8시'", async () => {
      const Settings = await loadSettings();
      const { unmount } = renderWithRouter(React.createElement(Settings));

      expect(screen.getByTestId("settings-hour-row").textContent).toContain(formatHour(21));

      fireEvent.click(screen.getByTestId("settings-hour-row"));
      const dialog = screen.getByRole("dialog");
      const option = within(dialog).getByRole("button", { name: formatHour(8) });
      expect(option.style.minHeight).toBe("44px");

      fireEvent.click(option);

      expect(storeRef.updateSettings).toHaveBeenCalledWith({ reminderHour: 8 });
      expect(storeRef.state.settings.reminderHour).toBe(8);

      unmount();
      renderWithRouter(React.createElement(Settings));
      expect(screen.getByTestId("settings-hour-row").textContent).toContain("오전 8시");
    });
  });

  describe("AC-3: cleanup confirm removes old check-ins via AlertDialog + shows Toast", () => {
    it("opens AlertDialog with '닫기', then calls pruneCheckIns(30) and toasts on '정리' click", async () => {
      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      fireEvent.click(screen.getByTestId("settings-cleanup-row"));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
      expect(storeRef.pruneCheckIns).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "정리" }));

      expect(storeRef.pruneCheckIns).toHaveBeenCalledTimes(1);
      expect(storeRef.pruneCheckIns).toHaveBeenCalledWith(30);
      expect(screen.getByText("오래된 기록을 정리했어요")).toBeInTheDocument();
    });

    it("pruneOlderThan(state, 30) removes a 31-day-old check-in but keeps a 29-day-old one", () => {
      const today = todayKST();
      const oldCheckIn: CheckIn = {
        id: "old",
        date: addDays(today, -31),
        choreId: "c_1",
        memberId: "m_me",
        weightAtLog: 1,
        createdAt: `${addDays(today, -31)}T00:00:00.000Z`,
      };
      const recentCheckIn: CheckIn = {
        id: "recent",
        date: addDays(today, -29),
        choreId: "c_1",
        memberId: "m_me",
        weightAtLog: 1,
        createdAt: `${addDays(today, -29)}T00:00:00.000Z`,
      };
      const state = makeState({ checkIns: [oldCheckIn, recentCheckIn] });

      const result = pruneOlderThan(state, 30);

      expect(result.checkIns).toHaveLength(1);
      expect(result.checkIns[0].id).toBe("recent");
    });
  });

  describe("AC-4: penalty switch off saves penaltyEnabled=false", () => {
    it("calls updateSettings({penaltyEnabled:false}) when the penalty switch is toggled off", async () => {
      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      const toggle = within(screen.getByTestId("settings-penalty-toggle")).getByRole("switch");
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      expect(storeRef.updateSettings).toHaveBeenCalledWith({ penaltyEnabled: false });
      expect(storeRef.state.settings.penaltyEnabled).toBe(false);
    });
  });

  describe("AC-5: no outbound-link/install-inducing copy, and custom touch targets are >= 44px", () => {
    it("renders zero <a> tags and no forbidden install/outlink phrases", async () => {
      const Settings = await loadSettings();
      const { container } = renderWithRouter(React.createElement(Settings));

      expect(container.querySelectorAll("a").length).toBe(0);
      const text = container.textContent ?? "";
      for (const forbidden of ["다운로드", "설치", "App Store", "Play 스토어", "google.com", "http://", "https://"]) {
        expect(text).not.toContain(forbidden);
      }
    });

    it("reminder and penalty toggle rows meet the 44px minimum touch target", async () => {
      const Settings = await loadSettings();
      renderWithRouter(React.createElement(Settings));

      expect(screen.getByTestId("settings-reminder-toggle").style.minHeight).toBe("44px");
      expect(screen.getByTestId("settings-penalty-toggle").style.minHeight).toBe("44px");
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
