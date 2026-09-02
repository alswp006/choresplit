/**
 * Packet 0013 Tests: 벌금 정산 제안 /settle (S7)
 *
 * Tests for src/pages/Settle.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: location.state의 weekStart를 널 체크 후 사용하고 없으면 이번 주로 폴백해 크래시 없이 렌더
 * - AC-2: 정산 라인이 'from → to 금액원' 형식, 합계가 총 벌금 이하, 모두 양의 정수
 * - AC-3: '정산 확정' 탭 → AlertDialog(왼쪽 버튼 '닫기') 확인 시 settlements 저장 + Toast
 * - AC-4: 이미 확정된 주는 확정 배지 + settledAt 표시, 확정 버튼 disabled로 중복 저장 방지
 * - AC-5: penaltyEnabled===false 이거나 미이행 벌금이 0원이면 EmptyState + 확정 버튼 비활성
 *
 * Implementation contract (testIds/labels the Coder MUST use — see assertions below):
 * - total penalty hero: <Amount value={totalPenalty} unit="원" testId="settle-total-penalty" />
 *   → textContent `${formatNumber(totalPenalty)}원`
 * - one row per settlement line: data-testid="settlement-line" (repeated), containing the
 *   text "{fromName} → {toName} {formatNumber(amount)}원"
 * - primary CTA: SubmitFooter/FixedBottomCTA button named "정산 확정" (role=button)
 * - clicking "정산 확정" opens an AlertDialog (role="alertdialog") — do NOT save immediately.
 *   The mocked AlertDialog auto-renders a "닫기" close button; the page must ALSO pass an
 *   alertButton with the text "확정" that performs the actual save on click.
 * - after confirming, addSettlement(record) is called (record.weekStart/lines/totalPenalty
 *   must match the computed settlement; record.settledAt is an ISO8601 string) and a
 *   Toast with text "정산을 확정했어요" is shown (assert via screen.getByText, NOT role=status —
 *   Badge also uses role=status).
 * - already-settled week: a Badge (role=status) with text containing "확정" is shown, and
 *   the settledAt value is rendered verbatim inside data-testid="settle-settled-at"
 * - zero-penalty / penaltyEnabled=false: EmptyState with title "이번 주는 정산할 벌금이 없어요"
 *   and the "정산 확정" CTA is disabled
 *
 * useAppState() is mocked at "@/lib/store" (this project's real state path — see packet-0010).
 * buildSettlement/getWeekStart are the REAL @/lib/report implementation (pure, packet-0004)
 * so every expected value below is independently computed, not guessed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { buildSettlement, getWeekStart } from "@/lib/report";
import { todayKST } from "@/lib/storage";
import { formatNumber } from "@/lib/utils";
import type { ChoreSplitState, Member, Chore, CheckIn, SettlementRecord } from "@/lib/types";

mockAll();

// ── Mock @/lib/store (this project's real state path) ──
const { storeRef } = vi.hoisted(() => ({
  storeRef: {
    ready: true as boolean,
    state: {} as any,
    error: null as string | null,
    unlocked: {} as Record<string, true>,
    unlock: vi.fn() as any,
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

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const THIS_WEEK_START = getWeekStart(todayKST());

// Chore missed on 4 of 7 days by everyone (only m_me checks in 3 days) → penalty 4000원,
// m_me carries 100% of weightedScore → computeSettlement pushes a single m_2 → m_me line.
function stateWithPenalty(overrides: Partial<ChoreSplitState> = {}): ChoreSplitState {
  const chore = makeChore({ id: "c_1", name: "설거지", penaltyAmount: 1000 });
  const checkIns: CheckIn[] = [0, 1, 2].map((d, i) =>
    makeCheckIn(addDays(THIS_WEEK_START, d), "c_1", "m_me", i),
  );
  return makeState({ chores: [chore], checkIns, ...overrides });
}

beforeEach(() => {
  mockLocation.state = null;
  storeRef.ready = true;
  storeRef.error = null;
  storeRef.unlocked = {};
  storeRef.unlock = vi.fn();
  storeRef.addSettlement = vi.fn(() => ({ ok: true }));
  storeRef.state = stateWithPenalty();
});

// Lazily imported so vi.mock("@/lib/store") above is in effect first.
async function loadSettle() {
  const mod = await import("@/pages/Settle");
  return mod.default;
}

describe("벌금 정산 제안 /settle (S7)", () => {
  describe("AC-1[P0]: missing/incomplete location.state falls back to this week", () => {
    it("renders this week's settlement when location.state is null (direct entry / refresh)", async () => {
      const expected = buildSettlement(storeRef.state, THIS_WEEK_START);
      expect(expected.totalPenalty).toBe(4000);
      mockLocation.state = null;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      expect(screen.getByTestId("settle-total-penalty").textContent).toBe(
        `${formatNumber(expected.totalPenalty)}원`,
      );
      expect(screen.getAllByTestId("settlement-line")).toHaveLength(expected.lines.length);
    });

    it("renders this week's settlement when location.state exists but weekStart is missing", async () => {
      const expected = buildSettlement(storeRef.state, THIS_WEEK_START);
      mockLocation.state = {} as any;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      expect(screen.getByTestId("settle-total-penalty").textContent).toBe(
        `${formatNumber(expected.totalPenalty)}원`,
      );
    });
  });

  describe("AC-2[P0]: settlement lines are 'from → to amount원', sum ≤ total, all positive integers", () => {
    it("renders one line per computed settlement, matching names/amount exactly", async () => {
      const expected = buildSettlement(storeRef.state, THIS_WEEK_START);
      expect(expected.lines).toEqual([{ fromMemberId: "m_2", toMemberId: "m_me", amount: 4000 }]);
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      const lines = screen.getAllByTestId("settlement-line");
      expect(lines).toHaveLength(1);
      expect(lines[0].textContent).toContain(`지민 → 민수 ${formatNumber(4000)}원`);

      const sum = expected.lines.reduce((acc, l) => acc + l.amount, 0);
      expect(sum).toBeLessThanOrEqual(expected.totalPenalty);
      for (const l of expected.lines) {
        expect(Number.isInteger(l.amount)).toBe(true);
        expect(l.amount).toBeGreaterThan(0);
      }
    });
  });

  describe("AC-3[P0]: confirming settlement via AlertDialog saves a SettlementRecord + shows Toast", () => {
    it("opens AlertDialog with a '닫기' button on CTA tap, then saves + toasts on '확정' click", async () => {
      const expected = buildSettlement(storeRef.state, THIS_WEEK_START);
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      fireEvent.click(screen.getByRole("button", { name: "정산 확정" }));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
      expect(storeRef.addSettlement).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "확정" }));

      expect(storeRef.addSettlement).toHaveBeenCalledTimes(1);
      const record = storeRef.addSettlement.mock.calls[0][0] as SettlementRecord;
      expect(record.weekStart).toBe(THIS_WEEK_START);
      expect(record.totalPenalty).toBe(expected.totalPenalty);
      expect(record.lines).toEqual(expected.lines);
      expect(record.settledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      expect(screen.getByText("정산을 확정했어요")).toBeInTheDocument();
    });
  });

  describe("AC-4[P0]: already-settled week shows a confirmed badge and disables the CTA", () => {
    it("shows confirmed badge + settledAt and never calls addSettlement again", async () => {
      const existing: SettlementRecord = {
        weekStart: THIS_WEEK_START,
        settledAt: "2026-02-10T09:30:00.000Z",
        lines: [{ fromMemberId: "m_2", toMemberId: "m_me", amount: 4000 }],
        totalPenalty: 4000,
      };
      storeRef.state = stateWithPenalty({ settlements: [existing] });
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      const badge = screen.getByRole("status");
      expect(badge.textContent).toContain("확정");
      expect(screen.getByTestId("settle-settled-at").textContent).toBe(existing.settledAt);

      const cta = screen.getByRole("button", { name: "정산 확정" });
      expect(cta).toBeDisabled();

      fireEvent.click(cta);
      expect(storeRef.addSettlement).not.toHaveBeenCalled();
    });
  });

  describe("AC-5[P0]: no penalty this week shows EmptyState and disables the CTA", () => {
    it("shows '이번 주는 정산할 벌금이 없어요' + disabled CTA when totalPenalty is 0", async () => {
      const chore = makeChore({ id: "c_1", name: "설거지", penaltyAmount: 0 });
      storeRef.state = makeState({ chores: [chore], checkIns: [] });
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      expect(screen.getByText("이번 주는 정산할 벌금이 없어요")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "정산 확정" })).toBeDisabled();
    });

    it("shows the same EmptyState when penaltyEnabled is false, even with unpaid chores", async () => {
      storeRef.state = stateWithPenalty({
        settings: { reminderEnabled: false, reminderHour: 21, penaltyEnabled: false, lastReminderShownDate: null },
      });
      mockLocation.state = { weekStart: THIS_WEEK_START } as any;

      const Settle = await loadSettle();
      renderWithRouter(React.createElement(Settle));

      expect(screen.getByText("이번 주는 정산할 벌금이 없어요")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "정산 확정" })).toBeDisabled();
    });
  });

  describe("Routing: App.tsx wires /settle", () => {
    it("registers a Route for /settle so ReportDetail's navigate('/settle') resolves", () => {
      const appPath = fileURLToPath(new URL("../App.tsx", import.meta.url));
      const source = readFileSync(appPath, "utf-8");
      expect(/path=["']\/settle["']/.test(source)).toBe(true);
    });
  });
});
