/**
 * Packet 0011 Tests: 주간 리포트 게이트 /report (S5)
 *
 * Tests for src/pages/Report.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: locked week → CTA gated behind TossRewardAd → after ad completes, unlock(weekStart)
 *   is called and navigate('/report/detail', { state: { weekStart } }) fires
 * - AC-2: already-unlocked week → CTA navigates to /report/detail immediately, no ad wait
 * - AC-3: zero check-ins this week → EmptyState '아직 이번 주 기록이 없어요' + '지금 기록하기' (→ '/'),
 *   report CTA disabled
 * - AC-4: 이번 주 / 지난 주 Chip toggling updates the summary card's count + fairness score
 * - AC-5: banner AdSlot renders below the content/CTA, zero HEX color literals in source
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path — see packet-0010).
 * buildWeeklyReport/getWeekStart are the REAL @/lib/report implementation (pure, packet-0004)
 * so the summary numbers asserted here are independently verified, not guessed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mockAll, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { buildWeeklyReport, getWeekStart } from "@/lib/report";
import { todayKST } from "@/lib/storage";
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
const CHORE: Chore = {
  id: "c_1",
  name: "설거지",
  weight: 2,
  frequency: "daily",
  penaltyAmount: 0,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeCheckIn(date: string, memberId: string, idx: number): CheckIn {
  return {
    id: `${date}__c_1__${memberId}__${idx}`,
    date,
    choreId: "c_1",
    memberId,
    weightAtLog: 2,
    createdAt: `${date}T00:00:00.000Z`,
  };
}

function makeState(overrides: Partial<ChoreSplitState> = {}): ChoreSplitState {
  return {
    version: 1,
    household: { id: "h_test1", name: "테스트가구", inviteCode: "AB12CD", createdAt: "2026-01-01T00:00:00.000Z" },
    members: [ME, JIMIN],
    chores: [CHORE],
    checkIns: [],
    settings: { reminderEnabled: false, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
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

// Computed from the real `today` at test-run time (via the real getWeekStart/todayKST),
// so the fixtures are correct regardless of which calendar day the suite runs on.
const THIS_WEEK_START = getWeekStart(todayKST());
const LAST_WEEK_START = addDays(THIS_WEEK_START, -7);

beforeEach(() => {
  mockLocation.state = null;
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.state = makeState();
  storeRef.unlocked = {};
  storeRef.unlock = vi.fn();
});

// Lazily imported so vi.mock("@/lib/store") above is in effect first.
async function loadReport() {
  const mod = await import("@/pages/Report");
  return mod.default;
}

describe("주간 리포트 게이트 /report (S5)", () => {
  describe("AC-1[P0]: locked week gates the CTA behind TossRewardAd", () => {
    it("unlocks storage and navigates to /report/detail once the reward ad completes", async () => {
      storeRef.state = makeState({ checkIns: [makeCheckIn(THIS_WEEK_START, "m_me", 1)] });
      storeRef.unlocked = {};

      const Report = await loadReport();
      renderWithRouter(React.createElement(Report));

      const cta = screen.getByRole("button", { name: "상세 리포트 보기" });
      expect(cta).not.toBeDisabled();
      expect(mockNavigate).not.toHaveBeenCalled();

      fireEvent.click(cta);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/report/detail", {
          state: { weekStart: THIS_WEEK_START },
        });
      });
      expect(storeRef.unlock).toHaveBeenCalledWith(THIS_WEEK_START);
    });
  });

  describe("AC-2[P0]: already-unlocked week skips the ad", () => {
    it("navigates to /report/detail immediately, without waiting on the ad callback", async () => {
      storeRef.state = makeState({ checkIns: [makeCheckIn(THIS_WEEK_START, "m_me", 1)] });
      storeRef.unlocked = { [THIS_WEEK_START]: true };

      const Report = await loadReport();
      renderWithRouter(React.createElement(Report));

      const cta = screen.getByRole("button", { name: "상세 리포트 보기" });
      fireEvent.click(cta);

      // No await/waitFor: TossRewardAd's mocked onReward only fires after a setTimeout(0)
      // tick, so an immediate assertion only passes when the gate was actually skipped.
      expect(mockNavigate).toHaveBeenCalledWith("/report/detail", {
        state: { weekStart: THIS_WEEK_START },
      });
    });
  });

  describe("AC-3[P0]: zero check-ins this week shows EmptyState + disables report CTA", () => {
    it("shows '아직 이번 주 기록이 없어요' with a '지금 기록하기' CTA to '/', and disables the report CTA", async () => {
      storeRef.state = makeState({ checkIns: [] });

      const Report = await loadReport();
      renderWithRouter(React.createElement(Report));

      expect(screen.getByText("아직 이번 주 기록이 없어요")).toBeInTheDocument();

      const reportCta = screen.getByRole("button", { name: "상세 리포트 보기" });
      expect(reportCta).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "지금 기록하기" }));
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  describe("AC-4[P0]: week Chip toggles the summary card values", () => {
    it("updates check-in count and fairness score when switching 이번 주 ↔ 지난 주", async () => {
      const checkIns: CheckIn[] = [
        makeCheckIn(THIS_WEEK_START, "m_me", 1),
        makeCheckIn(addDays(THIS_WEEK_START, 1), "m_me", 2),
        makeCheckIn(addDays(THIS_WEEK_START, 2), "m_2", 3),
        makeCheckIn(addDays(THIS_WEEK_START, 3), "m_2", 4),
        makeCheckIn(LAST_WEEK_START, "m_me", 5),
        makeCheckIn(addDays(LAST_WEEK_START, 1), "m_me", 6),
        makeCheckIn(addDays(LAST_WEEK_START, 2), "m_me", 7),
        makeCheckIn(addDays(LAST_WEEK_START, 3), "m_me", 8),
        makeCheckIn(addDays(LAST_WEEK_START, 4), "m_me", 9),
      ];
      storeRef.state = makeState({ checkIns });

      // Independently verify the expected numbers via the real report engine.
      const reportThis = buildWeeklyReport(storeRef.state, THIS_WEEK_START);
      const reportLast = buildWeeklyReport(storeRef.state, LAST_WEEK_START);
      const thisCount = reportThis.stats.reduce((sum, s) => sum + s.count, 0);
      const lastCount = reportLast.stats.reduce((sum, s) => sum + s.count, 0);
      expect(thisCount).toBe(4);
      expect(reportThis.fairnessScore).toBe(100);
      expect(lastCount).toBe(5);
      expect(reportLast.fairnessScore).toBe(0);

      const Report = await loadReport();
      renderWithRouter(React.createElement(Report));

      expect(screen.getByTestId("report-summary-count").textContent).toContain("4");
      expect(screen.getByTestId("report-summary-fairness").textContent).toContain("100");

      fireEvent.click(screen.getByRole("button", { name: "지난 주" }));

      expect(screen.getByTestId("report-summary-count").textContent).toContain("5");
      expect(screen.getByTestId("report-summary-fairness").textContent).toContain("0");
    });
  });

  describe("AC-5: banner AdSlot placement + copy/style hygiene", () => {
    it("renders the AdSlot after the report content/CTA, with zero HEX literals in source", async () => {
      storeRef.state = makeState({ checkIns: [makeCheckIn(THIS_WEEK_START, "m_me", 1)] });

      const Report = await loadReport();
      const { container } = renderWithRouter(React.createElement(Report));

      const adSlot = container.querySelector("[data-ad-group-id]");
      expect(adSlot).not.toBeNull();

      const cta = screen.getByRole("button", { name: "상세 리포트 보기" });
      // adSlot.compareDocumentPosition(cta) describes cta's position relative to adSlot;
      // DOCUMENT_POSITION_PRECEDING means cta comes before adSlot in the DOM (ad is below content).
      const position = adSlot!.compareDocumentPosition(cta);
      expect(Boolean(position & Node.DOCUMENT_POSITION_PRECEDING)).toBe(true);

      const sourcePath = fileURLToPath(new URL("../pages/Report.tsx", import.meta.url));
      const source = readFileSync(sourcePath, "utf-8");
      expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    });
  });

  describe("Routing: App.tsx wires /report", () => {
    it("registers a Route for /report so the home tab bar's link resolves", () => {
      const appPath = fileURLToPath(new URL("../App.tsx", import.meta.url));
      const source = readFileSync(appPath, "utf-8");
      expect(/path=["']\/report["']/.test(source)).toBe(true);
    });
  });
});
