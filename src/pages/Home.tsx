import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Top,
  Paragraph,
  Spacing,
  ListRow,
  Button,
  Chip as TdsChip,
  Toast,
  Asset,
} from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SummaryHero } from "@/components/SummaryHero";
import { Card } from "@/components/Card";
import { CountUp } from "@/components/CountUp";
import { EmptyState, LoadingState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { FloatingTabBar, type TabItem } from "@/components/FloatingTabBar";
import { useAppState } from "@/lib/store";
import { todayKST } from "@/lib/storage";
import { countTodayCheckIns, shouldShowReminder } from "@/lib/streak";
import type { ChoreId, MemberId } from "@/lib/types";

const VISIBLE_STEP = 20;

const TAB_ITEMS: TabItem[] = [
  { label: "홈", path: "/" },
  { label: "리포트", path: "/report" },
  { label: "스트릭", path: "/streak" },
  { label: "설정", path: "/settings" },
];

type ChipButtonProps = {
  children: ReactNode;
  selected?: boolean;
  variant?: "fill" | "weak";
  onClick?: () => void;
};

/**
 * 실제 TDS Chip은 Chip(그룹) + ChipItem(개별 항목) 조합이지만, 이 프로젝트의 테스트
 * 목(mocks.ts)은 Chip 하나를 role="button" + aria-pressed 인터랙션 요소로 다룬다.
 * 그 계약(및 화면 스펙의 selected/onClick 단일 사용법)에 맞춰 얇게 재캐스팅한다.
 */
const Chip = TdsChip as unknown as ComponentType<ChipButtonProps>;

function weightLabel(weight: 1 | 2 | 3): string {
  if (weight === 1) return "가벼움";
  if (weight === 2) return "보통";
  return "힘듦";
}

function addDaysKST(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function safeHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

export default function Home() {
  const navigate = useNavigate();
  const { ready, state, toggleCheckIn } = useAppState();

  const today = todayKST();
  const yesterday = addDaysKST(today, -1);

  const [selectedDate, setSelectedDate] = useState(today);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ready && !state.household) {
      navigate("/onboarding", { replace: true });
    }
  }, [ready, state.household, navigate]);

  const activeChores = useMemo(() => state.chores.filter((c) => c.active), [state.chores]);
  const members = state.members;
  const me = members.find((m) => m.isMe) ?? members[0];

  const selectedDateCheckIns = useMemo(
    () => state.checkIns.filter((c) => c.date === selectedDate),
    [state.checkIns, selectedDate],
  );
  const todayCount = selectedDateCheckIns.length;
  const checkedSet = useMemo(
    () => new Set(selectedDateCheckIns.map((c) => `${c.choreId}__${c.memberId}`)),
    [selectedDateCheckIns],
  );

  function isChecked(choreId: ChoreId, memberId: MemberId): boolean {
    const pairKey = `${choreId}__${memberId}`;
    const override = overrides[`${selectedDate}__${pairKey}`];
    if (override !== undefined) return override;
    return checkedSet.has(pairKey);
  }

  function handleToggle(choreId: ChoreId, memberId: MemberId) {
    const key = `${selectedDate}__${choreId}__${memberId}`;
    const prev = isChecked(choreId, memberId);
    const next = !prev;

    setOverrides((o) => ({ ...o, [key]: next }));
    safeHaptic();

    const result = toggleCheckIn(selectedDate, choreId, memberId);
    if (!result.ok) {
      setOverrides((o) => ({ ...o, [key]: prev }));
      setToastText(result.error ?? "저장에 실패했어요");
      setToastOpen(true);
      return;
    }
    setToastText(next ? "체크인 완료!" : "체크인을 취소했어요");
    setToastOpen(true);
  }

  function switchDate(date: string) {
    if (date === selectedDate) return;
    safeHaptic();
    setSelectedDate(date);
  }

  function scrollToList() {
    try {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      /* jsdom 등 미지원 환경 — 무시 */
    }
  }

  const myTodayCount = me ? countTodayCheckIns(state, me.id, today) : 0;
  const showReminder = ready && shouldShowReminder(state.settings, new Date(), myTodayCount);

  if (!ready) {
    return (
      <ScreenScaffold
        top={<Top title={<Top.TitleParagraph>{state.household?.name ?? "choresplit"}</Top.TitleParagraph>} />}
      >
        <LoadingState rows={4} testId="app-loading" />
      </ScreenScaffold>
    );
  }

  const visibleChores = activeChores.slice(0, visibleCount);

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>{state.household?.name ?? "choresplit"}</Top.TitleParagraph>}
          right={
            <Button variant="weak" size="small" onClick={() => navigate("/members")}>
              동거인
            </Button>
          }
        />
      }
      bottom={<FloatingTabBar items={TAB_ITEMS} />}
    >
      <SummaryHero
        testId="today-hero"
        label="오늘 체크인"
        value={<CountUp value={todayCount} unit="건" typography="t1" />}
        caption={`활성 항목 ${activeChores.length}개`}
      />

      {activeChores.length > 0 && todayCount === 0 && (
        <>
          <Spacing size={16} />
          <div
            data-testid="today-empty"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            <Asset.ContentIcon name="iconHomeRegular" alt="오늘 첫 집안일" />
            <Spacing size={12} />
            <Paragraph.Text typography="t6">오늘 첫 집안일을 기록해보세요</Paragraph.Text>
          </div>
        </>
      )}

      {showReminder && (
        <>
          <Spacing size={16} />
          <Card testId="reminder-banner">
            <Paragraph.Text typography="st11">오늘 집안일 기록을 잊지 않으셨나요?</Paragraph.Text>
            <Spacing size={12} />
            <Button variant="weak" size="medium" display="block" onClick={scrollToList}>
              지금 기록하기
            </Button>
          </Card>
        </>
      )}

      <Spacing size={16} />

      <div ref={listRef}>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip
            selected={selectedDate === yesterday}
            variant={selectedDate === yesterday ? "fill" : "weak"}
            onClick={() => switchDate(yesterday)}
          >
            어제
          </Chip>
          <Chip
            selected={selectedDate === today}
            variant={selectedDate === today ? "fill" : "weak"}
            onClick={() => switchDate(today)}
          >
            오늘
          </Chip>
        </div>

        <Spacing size={16} />

        {activeChores.length === 0 ? (
          <EmptyState
            title="집안일 항목을 먼저 추가해주세요"
            description="설거지, 청소 같은 항목을 등록하면 체크인할 수 있어요"
            action={
              <Button
                variant="weak"
                onClick={() => navigate("/chores", { state: { openCreate: true } })}
              >
                항목 관리
              </Button>
            }
          />
        ) : (
          <>
            {visibleChores.map((c) => (
              <ListRow
                key={c.id}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={c.name}
                    bottom={`${weightLabel(c.weight)} · ${c.frequency === "daily" ? "매일" : "주 1회"}`}
                  />
                }
                right={
                  <div style={{ display: "flex", gap: 8 }}>
                    {members.map((m) => (
                      <Chip
                        key={m.id}
                        selected={isChecked(c.id, m.id)}
                        variant={isChecked(c.id, m.id) ? "fill" : "weak"}
                        onClick={() => handleToggle(c.id, m.id)}
                      >
                        {m.name}
                      </Chip>
                    ))}
                  </div>
                }
              />
            ))}
            {activeChores.length > visibleCount && (
              <>
                <Spacing size={12} />
                <Button
                  variant="weak"
                  display="block"
                  onClick={() => setVisibleCount((v) => v + VISIBLE_STEP)}
                >
                  더 보기
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <Spacing size={24} />
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID ?? "home-bottom"} />
      <Spacing size={80} />

      <Toast open={toastOpen} text={toastText} position="bottom" onClose={() => setToastOpen(false)} />
    </ScreenScaffold>
  );
}
