import { useMemo, useState } from 'react';
import { Top, Button, Tab, Paragraph, Spacing, Badge } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useAppStore } from '@/lib/store';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { Sparkline } from '@/components/Sparkline';
import { LoadingState } from '@/components/StateView';
import { todayKST, weekKeyOf, shouldShowReminder, getKSTDate } from '@/domain/date';
import { calcStreak } from '@/domain/streak';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 현재 KST 시각을 "HH:MM"으로 (shouldShowReminder 비교용) */
function nowHHMM(): string {
  const d = getKSTDate();
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** todayKey부터 과거로 n일치 dateKey 배열(오름차순) */
function pastDays(todayKey: string, n: number): string[] {
  const [y, m, d] = todayKey.split('-').map(Number);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    keys.push(`${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`);
  }
  return keys;
}

const TOP_TITLE = '오늘의 체크인';

export default function Home() {
  const navigate = useNavigate();
  const { booting, household, logs, settings, schemaCompatible, saveSettings } = useAppStore();

  const members = household?.members ?? [];
  const [memberIdx, setMemberIdx] = useState(() => {
    const idx = members.findIndex((m) => m.id === settings.activeMemberId);
    return idx >= 0 ? idx : 0;
  });
  const activeMember = members[memberIdx] ?? null;

  const today = todayKST();

  const todayLogCount = useMemo(() => logs.filter((l) => l.date === today).length, [logs, today]);

  const todayWeight = useMemo(() => {
    if (!activeMember) return 0;
    return logs
      .filter((l) => l.date === today && l.memberId === activeMember.id)
      .reduce((sum, l) => sum + l.weight, 0);
  }, [logs, today, activeMember]);

  const streakDays = activeMember ? calcStreak(logs, activeMember.id, today).streakDays : 0;

  const weekTrend = useMemo(() => {
    if (!activeMember) return [];
    return pastDays(today, 7).map((day) =>
      logs
        .filter((l) => l.date === day && l.memberId === activeMember.id)
        .reduce((sum, l) => sum + l.weight, 0),
    );
  }, [logs, today, activeMember]);

  const showReminder =
    !booting &&
    shouldShowReminder(nowHHMM(), settings.reminderTime, 0, settings.reminderEnabled) &&
    todayLogCount === 0;

  function handleSelectMember(idx: number) {
    setMemberIdx(idx);
    const member = members[idx];
    if (member) {
      saveSettings({ ...settings, activeMemberId: member.id });
    }
    try {
      generateHapticFeedback({ type: 'tickWeak' });
    } catch {
      /* WebView 밖 — 무시 */
    }
  }

  function handleHeroClick() {
    navigate('/report', { state: { weekKey: weekKeyOf(today) } });
  }

  if (booting) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>{TOP_TITLE}</Top.TitleParagraph>} />}>
        <div data-testid="boot-skeleton">
          <LoadingState rows={6} />
        </div>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>{TOP_TITLE}</Top.TitleParagraph>}
          right={
            <Button variant="weak" size="small" onClick={() => navigate('/invite')}>
              초대
            </Button>
          }
        />
      }
    >
      {!schemaCompatible ? (
        <>
          <Card testId="schema-banner">
            <Paragraph.Text typography="st11">기록 형식이 달라 일부 기능이 제한돼요</Paragraph.Text>
          </Card>
          <Spacing size={16} />
        </>
      ) : null}

      {showReminder ? (
        <>
          <Card testId="reminder-banner">
            <Paragraph.Text typography="t6">오늘 아직 체크인하지 않았어요</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="st11">집안일 하나만 기록해볼까요?</Paragraph.Text>
          </Card>
          <Spacing size={16} />
        </>
      ) : null}

      {members.length > 0 ? (
        <>
          <Tab onChange={handleSelectMember}>
            {members.map((m, i) => (
              <Tab.Item key={m.id} selected={i === memberIdx} onClick={() => handleSelectMember(i)}>
                {m.emoji} {m.name}
              </Tab.Item>
            ))}
          </Tab>
          <Spacing size={16} />
        </>
      ) : null}

      <div data-testid="today-summary-hero" role="button" tabIndex={0} onClick={handleHeroClick} style={{ cursor: 'pointer' }}>
        <SummaryHero
          label="오늘 기여 점수"
          value={<Amount value={todayWeight} unit="점" typography="t1" />}
          caption={
            streakDays > 0 ? (
              <Badge size="small" variant="weak" color="blue">
                {streakDays}일 연속 기록 중
              </Badge>
            ) : undefined
          }
        />
      </div>

      <Spacing size={16} />
      <Sparkline testId="week-sparkline" data={weekTrend} />
      <Spacing size={24} />
    </ScreenScaffold>
  );
}
