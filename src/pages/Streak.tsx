import { useMemo } from "react";
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
  ListRow,
} from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SummaryHero } from "@/components/SummaryHero";
import { Card } from "@/components/Card";
import { CountUp } from "@/components/CountUp";
import { MiniBar } from "@/components/MiniBar";
import { EmptyState, LoadingState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { FloatingTabBar, type TabItem } from "@/components/FloatingTabBar";
import { useAppState } from "@/lib/store";
import { todayKST } from "@/lib/storage";
import { getStreak, getRanking } from "@/lib/streak";

const TAB_ITEMS: TabItem[] = [
  { label: "홈", path: "/" },
  { label: "리포트", path: "/report" },
  { label: "스트릭", path: "/streak" },
  { label: "설정", path: "/settings" },
];

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const RANKING_WINDOW_DAYS = 7;

type ChipButtonProps = {
  children: React.ReactNode;
  selected?: boolean;
  variant?: "fill" | "weak";
  onClick?: () => void;
};

// Home.tsx/Report.tsx와 동일한 캐스팅 — 테스트 목(mocks.ts)은 Chip을 단일
// role="button" 인터랙션 요소로 다룬다.
const Chip = TdsChip as unknown as ComponentType<ChipButtonProps>;

function addDaysKST(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function weekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_LABELS[day];
}

/** 날짜 문자열 집합에서 가장 긴 연속 구간 길이 — 최고 기록(all-time) 계산용. */
function longestRun(dates: string[]): number {
  const set = new Set(dates);
  let best = 0;
  for (const d of set) {
    if (set.has(addDaysKST(d, -1))) continue; // 구간 시작점이 아니면 스킵
    let cursor = d;
    let len = 0;
    while (set.has(cursor)) {
      len += 1;
      cursor = addDaysKST(cursor, 1);
    }
    best = Math.max(best, len);
  }
  return best;
}

function safeHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? "streak-banner";

export default function Streak() {
  const navigate = useNavigate();
  const { ready, state, error } = useAppState();

  const today = todayKST();
  const me = state.members.find((m) => m.isMe) ?? state.members[0];

  const currentStreak = me ? getStreak(state, me.id, today) : 0;

  const bestStreak = useMemo(() => {
    if (!me) return 0;
    const myDates = state.checkIns.filter((c) => c.memberId === me.id).map((c) => c.date);
    return longestRun(myDates);
  }, [state.checkIns, me]);

  const last7 = useMemo(() => {
    const days: Array<{ date: string; checked: boolean; label: string }> = [];
    for (let i = RANKING_WINDOW_DAYS - 1; i >= 0; i--) {
      const date = addDaysKST(today, -i);
      const checked = me
        ? state.checkIns.some((c) => c.memberId === me.id && c.date === date)
        : false;
      days.push({ date, checked, label: weekdayLabel(date) });
    }
    return days;
  }, [state.checkIns, me, today]);

  const ranking = useMemo(
    () => getRanking(state, RANKING_WINDOW_DAYS),
    [state],
  );

  const isEmpty = state.checkIns.length === 0;

  function goHome() {
    safeHaptic("success");
    navigate("/");
  }

  if (!ready) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>스트릭</Top.TitleParagraph>} />}>
        <LoadingState rows={4} testId="streak-loading" />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>스트릭</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TAB_ITEMS} />}
    >
      {isEmpty ? (
        <EmptyState
          icon={<Asset.ContentIcon name="iconHomeRegular" alt="스트릭 없음" />}
          title="오늘부터 스트릭을 시작해보세요"
          description="집안일을 체크인하면 연속 기록이 쌓여요"
          action={
            <Button variant="weak" onClick={goHome}>
              기록하러 가기
            </Button>
          }
        />
      ) : (
        <>
          <SummaryHero
            testId="streak-hero"
            label="연속 기록"
            value={
              <CountUp value={currentStreak} unit="일" typography="t1" testId="streak-current" />
            }
            caption={<span data-testid="streak-best">{`최고 기록 ${bestStreak}일`}</span>}
          />
          <Spacing size={16} />
          <Card>
            <Paragraph.Text typography="st11">최근 7일</Paragraph.Text>
            <Spacing size={12} />
            <div style={{ display: "flex", gap: 8 }}>
              {last7.map((d) => (
                <div key={d.date} data-testid="streak-day" data-checked={d.checked ? "true" : "false"}>
                  <Chip selected={d.checked} variant={d.checked ? "fill" : "weak"}>
                    {d.label}
                  </Chip>
                </div>
              ))}
            </div>
          </Card>
          <Spacing size={16} />
          <Card>
            <Paragraph.Text typography="st11">이번 주 랭킹</Paragraph.Text>
            <Spacing size={12} />
            {ranking.map((r, i) => {
              const isSelf = me ? r.memberId === me.id : false;
              return (
                <ListRow
                  key={r.memberId}
                  data-testid="ranking-row"
                  data-self={isSelf ? "true" : "false"}
                  left={<Chip selected={isSelf}>{String(i + 1)}</Chip>}
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={isSelf ? `${r.memberName} (나)` : r.memberName}
                      bottom={`${r.count}건 · ${r.sharePct}%`}
                    />
                  }
                  right={<MiniBar ratio={r.sharePct / 100} />}
                />
              );
            })}
          </Card>
          <Spacing size={24} />
          <AdSlot adGroupId={AD_GROUP_ID} />
          <Spacing size={80} />
        </>
      )}

      <Toast open={Boolean(error)} text={error ?? ""} position="bottom" onClose={() => {}} />
    </ScreenScaffold>
  );
}
