import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  Top,
  Paragraph,
  Spacing,
  Chip as TdsChip,
  Button,
  Toast,
  Asset,
} from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { EmptyState, LoadingState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { TossRewardAd } from "@/components/TossRewardAd";
import { FloatingTabBar, type TabItem } from "@/components/FloatingTabBar";
import { useAppState } from "@/lib/store";
import { todayKST } from "@/lib/storage";
import { buildWeeklyReport, getWeekStart } from "@/lib/report";

const TAB_ITEMS: TabItem[] = [
  { label: "홈", path: "/" },
  { label: "리포트", path: "/report" },
  { label: "스트릭", path: "/streak" },
  { label: "설정", path: "/settings" },
];

type ChipButtonProps = {
  children: React.ReactNode;
  selected?: boolean;
  variant?: "fill" | "weak";
  onClick?: () => void;
};

// Home.tsx와 동일한 캐스팅 — 실제 Chip은 그룹+아이템 조합이지만
// 테스트 목(mocks.ts)은 단일 role="button" 요소로 다룬다.
const Chip = TdsChip as unknown as ComponentType<ChipButtonProps>;

function shiftWeek(weekStart: string, weeks: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function safeHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

const AD_SLOT_ID = import.meta.env.VITE_TOSS_AD_SLOT_ID ?? "report-unlock";
const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? "report-banner";

export default function Report() {
  const navigate = useNavigate();
  const { ready, state, unlocked, unlock } = useAppState();

  useEffect(() => {
    if (ready && !state.household) {
      navigate("/onboarding", { replace: true });
    }
  }, [ready, state.household, navigate]);

  const [sel, setSel] = useState<"this" | "last">("this");
  const [toastOpen, setToastOpen] = useState(false);

  if (!ready) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>주간 리포트</Top.TitleParagraph>} />}>
        <LoadingState rows={3} testId="report-loading" />
      </ScreenScaffold>
    );
  }

  const thisWeekStart = getWeekStart(todayKST());
  const lastWeekStart = shiftWeek(thisWeekStart, -1);
  const weekStart = sel === "this" ? thisWeekStart : lastWeekStart;

  const report = buildWeeklyReport(state, weekStart);
  const totalCount = report.stats.reduce((sum, s) => sum + s.count, 0);
  const isUnlocked = unlocked[weekStart] === true;
  const isEmpty = totalCount === 0;
  const weekLabel = sel === "this" ? "이번 주" : "지난 주";

  function switchWeek(next: "this" | "last") {
    if (next === sel) return;
    safeHaptic("tickWeak");
    setSel(next);
  }

  function goDetail() {
    navigate("/report/detail", { state: { weekStart } });
  }

  function unlockAndGo() {
    safeHaptic("success");
    unlock(weekStart);
    goDetail();
  }

  function handleAdError() {
    setToastOpen(true);
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>주간 리포트</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TAB_ITEMS} />}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <Chip selected={sel === "this"} onClick={() => switchWeek("this")}>
          이번 주
        </Chip>
        <Chip selected={sel === "last"} onClick={() => switchWeek("last")}>
          지난 주
        </Chip>
      </div>
      <Spacing size={16} />
      <Card>
        <Paragraph.Text typography="st11">{`${report.weekStart} ~ ${report.weekEnd}`}</Paragraph.Text>
        <Spacing size={8} />
        <Amount value={totalCount} unit="건" typography="t2" testId="report-summary-count" />
        <Spacing size={8} />
        <span data-testid="report-summary-fairness">
          <Paragraph.Text typography="st11">{`공정성 점수 ${report.fairnessScore}점`}</Paragraph.Text>
        </span>
      </Card>
      <Spacing size={24} />

      {isEmpty ? (
        <>
          <EmptyState
            icon={<Asset.ContentIcon name="iconHomeRegular" alt="기록 없음" />}
            title={`아직 ${weekLabel} 기록이 없어요`}
            description="집안일을 체크인하면 리포트가 채워져요"
            action={
              <Button variant="weak" onClick={() => navigate("/")}>
                지금 기록하기
              </Button>
            }
          />
          <Button variant="fill" size="large" display="block" disabled>
            상세 리포트 보기
          </Button>
        </>
      ) : isUnlocked ? (
        <Button variant="fill" size="large" display="block" onClick={goDetail}>
          상세 리포트 보기
        </Button>
      ) : (
        <TossRewardAd
          slotId={AD_SLOT_ID}
          description="광고를 시청하면 상세 리포트를 볼 수 있어요"
          buttonText="광고 보고 리포트 열기"
          onError={handleAdError}
        >
          <Button variant="fill" size="large" display="block" onClick={unlockAndGo}>
            상세 리포트 보기
          </Button>
        </TossRewardAd>
      )}

      <Spacing size={24} />
      <AdSlot adGroupId={AD_GROUP_ID} />

      <Toast
        open={toastOpen}
        text="광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"
        position="bottom"
        onClose={() => setToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
