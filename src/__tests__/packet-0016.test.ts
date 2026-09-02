import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import type { AppSettings } from "@/lib/types";

/**
 * PACKET 0016: src/components/ReportDetail.tsx — 리포트 상세 + 리워드 광고 게이트
 *
 * Expected export from src/components/ReportDetail.tsx (NOT YET IMPLEMENTED — red phase):
 *   export function ReportDetail({ weekKey, contributions, dailyTrend }: {
 *     weekKey: string;                    // 'YYYY-Www'
 *     contributions: { memberId: string; name: string; emoji: string; ratio: number }[];
 *     dailyTrend: number[];               // length 7, 요일별 기여
 *   }): JSX.Element
 *
 * Reads settings/saveSettings from useAppStore() (@/lib/store).
 * - settings.reportUnlockedWeeks에 weekKey가 없으면: 상세를 숨기고 잠금 카드
 *   (testId="report-lock-card") + TossRewardAd 잠금 버튼("광고 보고 확인하기")을 렌더.
 *   상세 콘텐츠(testId="report-detail-content")는 이 상태에서 렌더되지 않는다(겹치지 않음).
 * - 광고 시청 완료(TossRewardAd의 onRewarded) 시: saveSettings({ ...settings,
 *   reportUnlockedWeeks: [...] })를 호출해 weekKey를 추가하고(중복 없이, 12개 초과 시 오래된 것부터
 *   제거) 상세가 즉시 노출된다.
 * - settings.reportUnlockedWeeks에 weekKey가 이미 있으면: TossRewardAd/광고 로드 없이 바로
 *   상세(testId="report-detail-content")가 렌더된다 — loadFullScreenAd가 호출되지 않는다.
 * - 상세 콘텐츠: contributions 각 항목이 ListRow(testId="report-contribution-row") +
 *   MiniBar(testId="report-contribution-bar")로 렌더되고, dailyTrend(length 7)가
 *   Sparkline(testId="report-trend-sparkline")으로 렌더된다. 데이터가 비어 있거나 전부 0이어도
 *   예외 없이 렌더된다.
 * - TossRewardAd에 slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}가 전달된다(loadFullScreenAd
 *   호출 인자로 확인).
 */

mockTds();
mockAppsInToss();

const mockUseAppStore = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: () => mockUseAppStore(),
}));

import { ReportDetail } from "@/components/ReportDetail";
import { loadFullScreenAd } from "@apps-in-toss/web-framework";

const WEEK_KEY = "2025-W20";

const BASE_SETTINGS: AppSettings = {
  activeMemberId: "mb_member01",
  reminderEnabled: true,
  reminderTime: "21:00",
  onboardingDone: true,
  lastReportWeekKey: null,
  reportUnlockedWeeks: [],
};

const CONTRIBUTIONS = [
  { memberId: "mb_member01", name: "민지", emoji: "🙂", ratio: 0.6 },
  { memberId: "mb_member02", name: "태호", emoji: "😎", ratio: 0.4 },
];

const DAILY_TREND = [1, 2, 0, 3, 1, 4, 2]; // length 7

const mockSaveSettings = vi.fn();

function setStore(settings: AppSettings) {
  mockUseAppStore.mockReturnValue({
    booting: false,
    household: null,
    tasks: [],
    logs: [],
    settings,
    schemaCompatible: true,
    toast: null,
    toggleLog: vi.fn(),
    saveTask: vi.fn(),
    saveSettings: mockSaveSettings,
  });
}

function renderDetail(
  weekKey = WEEK_KEY,
  contributions = CONTRIBUTIONS,
  dailyTrend = DAILY_TREND,
) {
  return render(
    React.createElement(ReportDetail, { weekKey, contributions, dailyTrend }),
  );
}

beforeEach(() => {
  mockSaveSettings.mockClear();
  vi.mocked(loadFullScreenAd).mockClear();
});

describe("리포트 상세 + 리워드 광고 게이트", () => {
  it("AC-1[P0]: weekKey가 reportUnlockedWeeks에 없으면 잠금 카드 + 광고 버튼만 보이고 상세는 숨겨진다", () => {
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: [] });
    renderDetail();

    expect(screen.getByTestId("report-lock-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "광고 보고 확인하기" })).toBeInTheDocument();
    expect(screen.queryByTestId("report-detail-content")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("report-contribution-row")).toHaveLength(0);
  });

  it("AC-1[P0]: 다른 주(weekKey)가 unlock돼 있어도 이번 주가 없으면 잠금 카드가 보인다", () => {
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: ["2025-W19"] });
    renderDetail();

    expect(screen.getByTestId("report-lock-card")).toBeInTheDocument();
    expect(screen.queryByTestId("report-detail-content")).not.toBeInTheDocument();
  });

  it("AC-2[P0]: 광고 시청 완료 후 상세가 노출되고 saveSettings로 weekKey가 reportUnlockedWeeks에 추가된다", async () => {
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: [] });
    renderDetail();

    const button = await screen.findByRole("button", { name: "광고 보고 확인하기" });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByTestId("report-detail-content")).toBeInTheDocument());
    expect(screen.queryByTestId("report-lock-card")).not.toBeInTheDocument();

    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    const saved = mockSaveSettings.mock.calls[0][0] as AppSettings;
    expect(saved.reportUnlockedWeeks).toContain(WEEK_KEY);
    expect(saved.reportUnlockedWeeks).toHaveLength(1);
  });

  it("AC-2: 이미 unlock된 weekKey는 광고 로드 없이 바로 상세가 보인다", () => {
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: [WEEK_KEY] });
    renderDetail();

    expect(screen.getByTestId("report-detail-content")).toBeInTheDocument();
    expect(screen.queryByTestId("report-lock-card")).not.toBeInTheDocument();
    expect(loadFullScreenAd).not.toHaveBeenCalled();
  });

  it("AC-3: reportUnlockedWeeks가 12개를 초과하면 가장 오래된 항목부터 제거해 12개로 유지한다", async () => {
    const existing = Array.from({ length: 12 }, (_, i) => `2025-W${String(i + 1).padStart(2, "0")}`);
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: existing });
    renderDetail(WEEK_KEY);

    const button = await screen.findByRole("button", { name: "광고 보고 확인하기" });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledTimes(1));
    const saved = mockSaveSettings.mock.calls[0][0] as AppSettings;
    expect(saved.reportUnlockedWeeks).toHaveLength(12);
    expect(saved.reportUnlockedWeeks).not.toContain("2025-W01");
    expect(saved.reportUnlockedWeeks[saved.reportUnlockedWeeks.length - 1]).toBe(WEEK_KEY);
  });

  it("AC-4: unlock 상태에서 항목별 기여 ListRow+MiniBar와 길이 7 Sparkline이 렌더된다", () => {
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: [WEEK_KEY] });
    renderDetail();

    const rows = screen.getAllByTestId("report-contribution-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId("report-contribution-bar")).toBeInTheDocument();
    expect(within(rows[0]).getByTestId("report-contribution-bar")).toHaveAttribute(
      "aria-valuenow",
      "60",
    );

    expect(screen.getByTestId("report-trend-sparkline")).toBeInTheDocument();
  });

  it("AC-4: 기여/추이 데이터가 모두 0이어도 예외 없이 렌더된다", () => {
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: [WEEK_KEY] });
    expect(() =>
      renderDetail(
        WEEK_KEY,
        [{ memberId: "mb_member01", name: "민지", emoji: "🙂", ratio: 0 }],
        [0, 0, 0, 0, 0, 0, 0],
      ),
    ).not.toThrow();

    expect(screen.getByTestId("report-detail-content")).toBeInTheDocument();
    expect(screen.getByTestId("report-trend-sparkline")).toBeInTheDocument();
  });

  it("AC-5: TossRewardAd에 slotId로 VITE_TOSS_AD_SLOT_ID가 전달된다", async () => {
    setStore({ ...BASE_SETTINGS, reportUnlockedWeeks: [] });
    renderDetail();

    await waitFor(() => expect(loadFullScreenAd).toHaveBeenCalledTimes(1));
    const call = vi.mocked(loadFullScreenAd).mock.calls[0][0] as unknown as { slotId: string };
    expect(call.slotId).toBe(import.meta.env.VITE_TOSS_AD_SLOT_ID);
  });
});
