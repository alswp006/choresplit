import { useEffect, useRef, useState } from "react";
import { Asset, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import { Card } from "@/components/Card";
import { MiniBar } from "@/components/MiniBar";
import { Sparkline } from "@/components/Sparkline";
import { useAppStore } from "@/lib/store";
import { MAX_UNLOCKED_WEEKS } from "@/lib/types";
import "@/styles/reward-ad.css";

const AD_SLOT_ID = import.meta.env.VITE_TOSS_AD_SLOT_ID;
const AD_TIMEOUT_MS = 15000;
const REWARD_BUTTON_LABEL = "광고 보고 확인하기";

interface Contribution {
  memberId: string;
  name: string;
  emoji: string;
  ratio: number;
}

interface ReportDetailProps {
  /** 'YYYY-Www' */
  weekKey: string;
  contributions: Contribution[];
  /** length 7, 요일별 기여 */
  dailyTrend: number[];
}

function addUnlockedWeek(weeks: string[], weekKey: string): string[] {
  const next = [...weeks.filter((w) => w !== weekKey), weekKey];
  return next.length > MAX_UNLOCKED_WEEKS ? next.slice(next.length - MAX_UNLOCKED_WEEKS) : next;
}

/**
 * 리포트 상세 — 항목별 기여 비중 + 요일별 추이. weekKey가 미해제 상태면 리워드 광고 게이트로 감춘다.
 *
 * TossRewardAd 컴포넌트를 감싸지 않고 loadFullScreenAd/showFullScreenAd를 직접 호출한다 —
 * 광고 로드/시청 완료 시점을 이 화면의 unlock 상태(및 12개 캡 로직)와 한 번에 묶어야 해서다.
 * 시청 완료(handleRewarded) 시 saveSettings로 즉시 반영하고, 같은 렌더에서 잠금 카드 서브트리
 * 전체가 상세 콘텐츠로 교체되므로 report-lock-card와 report-detail-content는 동시에 존재하지 않는다.
 */
export function ReportDetail({ weekKey, contributions, dailyTrend }: ReportDetailProps) {
  const { settings, saveSettings } = useAppStore();
  const [watched, setWatched] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlocked = watched || settings.reportUnlockedWeeks.includes(weekKey);

  function handleRewarded() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setWatched(true);
    saveSettings({
      ...settings,
      reportUnlockedWeeks: addUnlockedWeek(settings.reportUnlockedWeeks, weekKey),
    });
  }

  useEffect(() => {
    if (unlocked) return;
    try {
      loadFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: () => setAdLoaded(true),
        onError: () => handleRewarded(),
      } as Parameters<typeof loadFullScreenAd>[0]);
    } catch {
      // SDK 불가(WebView 밖) — 자동 해제
      handleRewarded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleWatch() {
    setIsShowing(true);
    timeoutRef.current = setTimeout(() => handleRewarded(), AD_TIMEOUT_MS);
    try {
      showFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: () => handleRewarded(),
        onError: () => handleRewarded(),
      } as Parameters<typeof showFullScreenAd>[0]);
    } catch {
      handleRewarded();
    }
  }

  if (!unlocked) {
    return (
      <Card
        testId="report-lock-card"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
      >
        <Asset.ContentIcon name="iconLockRegular" alt="잠김" />
        <Spacing size={12} />
        <Paragraph.Text typography="st11">항목별 상세는 광고를 보고 확인할 수 있어요</Paragraph.Text>
        <Spacing size={16} />
        <button
          className={`reward-ad-button${isShowing ? " reward-ad-button--loading" : ""}`}
          onClick={handleWatch}
          disabled={isShowing || !adLoaded}
          aria-label={REWARD_BUTTON_LABEL}
        >
          {isShowing ? "광고 재생 중..." : !adLoaded ? "광고 준비 중..." : REWARD_BUTTON_LABEL}
        </button>
      </Card>
    );
  }

  return (
    <div data-testid="report-detail-content">
      <Paragraph.Text typography="t4">항목별 기여</Paragraph.Text>
      <Spacing size={12} />
      {contributions.length === 0 ? (
        <Paragraph.Text typography="st11">이 주에는 항목 기록이 없어요</Paragraph.Text>
      ) : (
        <Card testId="report-contribution-card">
          {contributions.map((c) => (
            <ListRow
              key={c.memberId}
              data-testid="report-contribution-row"
              left={<Paragraph.Text typography="t3">{c.emoji}</Paragraph.Text>}
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={c.name}
                  bottom={`${Math.round(c.ratio * 100)}%`}
                />
              }
              right={<MiniBar ratio={c.ratio} testId="report-contribution-bar" />}
            />
          ))}
        </Card>
      )}
      <Spacing size={20} />
      <Paragraph.Text typography="t4">요일별 추이</Paragraph.Text>
      <Spacing size={12} />
      <Sparkline data={dailyTrend} testId="report-trend-sparkline" />
      <Spacing size={24} />
    </div>
  );
}
