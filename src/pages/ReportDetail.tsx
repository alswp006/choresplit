import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, ListRow, Button, Badge, Asset } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { SummaryHero } from "@/components/SummaryHero";
import { Amount } from "@/components/Amount";
import { MiniBar } from "@/components/MiniBar";
import { Sparkline } from "@/components/Sparkline";
import { EmptyState, LoadingState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { useAppState } from "@/lib/store";
import { todayKST } from "@/lib/storage";
import { buildWeeklyReport, getWeekEnd, getWeekStart } from "@/lib/report";
import { formatNumber } from "@/lib/utils";

interface ReportDetailLocationState {
  weekStart?: string;
}

function safeHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

function fairnessLabel(score: number): string {
  if (score >= 80) return "매우 공정";
  if (score >= 50) return "공정";
  return "불균형";
}

function fairnessColor(score: number): "green" | "blue" | "red" {
  if (score >= 80) return "green";
  if (score >= 50) return "blue";
  return "red";
}

const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? "report-detail-banner";

export default function ReportDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ready, state, unlocked } = useAppState();

  const routeState = (location.state as ReportDetailLocationState | null) ?? null;
  const weekStart =
    routeState?.weekStart && routeState.weekStart.length > 0
      ? getWeekStart(routeState.weekStart)
      : getWeekStart(todayKST());

  useEffect(() => {
    if (ready && !state.household) {
      navigate("/onboarding", { replace: true });
    }
  }, [ready, state.household, navigate]);

  useEffect(() => {
    if (ready && state.household && unlocked[weekStart] !== true) {
      navigate("/report", { replace: true });
    }
  }, [ready, state.household, unlocked, weekStart, navigate]);

  const [retryTick, setRetryTick] = useState(0);

  if (!ready) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>주간 리포트</Top.TitleParagraph>} />}>
        <LoadingState rows={5} testId="report-detail-loading" />
      </ScreenScaffold>
    );
  }

  let report;
  let computeError: string | null = null;
  try {
    report = buildWeeklyReport(state, weekStart);
  } catch {
    computeError = "리포트를 계산하지 못했어요. 잠시 후 다시 시도해주세요";
  }

  const weekEnd = getWeekEnd(weekStart);

  if (computeError || !report) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>주간 리포트</Top.TitleParagraph>} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconWarningRegular" alt="계산 실패" />}
          title={computeError ?? "리포트를 계산하지 못했어요"}
          action={
            <Button variant="weak" onClick={() => setRetryTick((t) => t + 1)}>
              다시 시도
            </Button>
          }
          testId="report-detail-error"
        />
      </ScreenScaffold>
    );
  }

  const totalCount = report.stats.reduce((sum, s) => sum + s.count, 0);
  const missedItems = report.missedItems.filter((m) => m.missedCount > 0);

  if (totalCount === 0) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>{`${weekStart} ~ ${weekEnd}`}</Top.TitleParagraph>} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconHomeRegular" alt="기록 없음" />}
          title="이번 주 기록이 없어 리포트를 만들 수 없어요"
          description="집안일을 체크인하면 리포트가 채워져요"
          action={
            <Button variant="weak" onClick={() => navigate("/")}>
              홈으로
            </Button>
          }
          testId="report-detail-empty"
        />
      </ScreenScaffold>
    );
  }

  function goSettle() {
    safeHaptic("success");
    navigate("/settle", { state: { weekStart } });
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>{`${weekStart} ~ ${weekEnd}`}</Top.TitleParagraph>} />}>
      <SummaryHero
        label="공정성 점수"
        value={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Amount value={report.fairnessScore} unit="점" typography="t1" testId="fairness-score-value" />
            <Badge size="medium" variant="weak" color={fairnessColor(report.fairnessScore)}>
              {fairnessLabel(report.fairnessScore)}
            </Badge>
          </div>
        }
        caption={`총 기여 ${formatNumber(report.totalWeighted)}점`}
      />
      <Spacing size={24} />

      <Card>
        <Paragraph.Text typography="st11">멤버별 기여</Paragraph.Text>
        <Spacing size={12} />
        {report.stats.map((s) => (
          <div key={s.memberId} data-testid="member-contribution-row">
            <MiniBar ratio={s.sharePct / 100} />
            <Spacing size={4} />
            <Paragraph.Text typography="st12">{`${s.memberName} · ${s.count}건 · ${s.sharePct.toFixed(1)}%`}</Paragraph.Text>
            <Spacing size={8} />
          </div>
        ))}
      </Card>
      <Spacing size={16} />

      <Card>
        <Paragraph.Text typography="st11">요일별 체크인</Paragraph.Text>
        <Spacing size={12} />
        <Sparkline data={report.dailyTrend} testId="weekly-sparkline" />
      </Card>
      <Spacing size={16} />

      <Card>
        <Paragraph.Text typography="st11">많이 한 집안일</Paragraph.Text>
        <Spacing size={12} />
        {report.topChores.map((t) => (
          <div key={t.choreId} data-testid="top-chore-row">
            <ListRow
              contents={<ListRow.Texts type="1RowTypeA" top={t.choreName} />}
              right={<Paragraph.Text typography="st11">{`${t.count}건`}</Paragraph.Text>}
            />
          </div>
        ))}
      </Card>
      <Spacing size={16} />

      <Card>
        <Paragraph.Text typography="st11">놓친 집안일</Paragraph.Text>
        <Spacing size={12} />
        {missedItems.length === 0 ? (
          <Paragraph.Text typography="st12">이번 주엔 놓친 집안일이 없어요</Paragraph.Text>
        ) : (
          missedItems.map((m) => (
            <div key={m.choreId} data-testid="missed-item-row">
              <ListRow
                contents={<ListRow.Texts type="2RowTypeA" top={m.choreName} bottom={`${m.missedCount}회 미이행`} />}
                right={<Paragraph.Text typography="st11">{`${formatNumber(m.penalty)}원`}</Paragraph.Text>}
              />
            </div>
          ))
        )}
        <Spacing size={12} />
        <Button variant="weak" size="medium" display="block" onClick={goSettle}>
          정산 제안 보기
        </Button>
      </Card>
      <Spacing size={24} />

      <AdSlot adGroupId={AD_GROUP_ID} />
    </ScreenScaffold>
  );
}
