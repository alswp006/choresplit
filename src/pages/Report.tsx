import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Top, Button, Paragraph, Spacing, Badge } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useAppStore } from '@/lib/store';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { CountUp } from '@/components/CountUp';
import { MiniBar } from '@/components/MiniBar';
import { EmptyState, LoadingState } from '@/components/StateView';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { todayKST, weekKeyOf, weekRange, shiftWeek } from '@/domain/date';
import { calcFairness, gradeOf, weeklyWeightsByMember } from '@/domain/fairness';
import { MAX_WEEK_BACK } from '@/lib/types';
import type { RouteState } from '@/lib/types';

const TOP_TITLE = '주간 리포트';

const GRADE_COLOR: Record<string, 'blue' | 'teal' | 'yellow' | 'red'> = {
  완벽: 'blue',
  양호: 'teal',
  주의: 'yellow',
  불균형: 'red',
};

function weekLabel(weekKey: string): string {
  const { start, end } = weekRange(weekKey);
  const fmt = (dateKey: string) => {
    const [, m, d] = dateKey.split('-').map(Number);
    return `${m}월 ${d}일`;
  };
  return `${fmt(start)} ~ ${fmt(end)}`;
}

function haptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    /* WebView 밖 — 무시 */
  }
}

export default function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { booting, household, logs } = useAppStore();

  const state = (location.state as RouteState['/report']) ?? undefined;
  const currentWeek = weekKeyOf(todayKST());
  const weekKey = searchParams.get('week') ?? state?.weekKey ?? currentWeek;
  const minWeek = shiftWeek(currentWeek, -MAX_WEEK_BACK);

  function goTo(nextWeek: string) {
    haptic();
    setSearchParams({ week: nextWeek });
  }

  if (booting) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>{TOP_TITLE}</Top.TitleParagraph>} />}>
        <div data-testid="boot-skeleton">
          <LoadingState rows={4} />
        </div>
      </ScreenScaffold>
    );
  }

  const members = household?.members ?? [];
  const weekLogs = logs.filter((l) => weekKeyOf(l.date) === weekKey);
  const weightsByMember = weeklyWeightsByMember(logs, weekKey);
  const weights = members.map((m) => ({ memberId: m.id, weight: weightsByMember[m.id] ?? 0 }));
  const targets = Object.fromEntries(members.map((m) => [m.id, m.targetShare]));
  const result = calcFairness(weights, targets);
  const grade = gradeOf(result.fairness);

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{TOP_TITLE}</Top.TitleParagraph>} />}
      bottom={
        <FloatingTabBar
          items={[
            { label: '홈', path: '/' },
            { label: '리포트', path: '/report' },
            { label: '랭킹', path: '/ranking' },
            { label: '설정', path: '/settings' },
          ]}
        />
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Button
          variant="weak"
          size="small"
          aria-label="이전 주"
          disabled={weekKey <= minWeek}
          onClick={() => goTo(shiftWeek(weekKey, -1))}
        >
          이전 주
        </Button>
        <Paragraph.Text typography="t5">{weekLabel(weekKey)}</Paragraph.Text>
        <Button
          variant="weak"
          size="small"
          aria-label="다음 주"
          disabled={weekKey >= currentWeek}
          onClick={() => goTo(shiftWeek(weekKey, 1))}
        >
          다음 주
        </Button>
      </div>
      <Spacing size={16} />

      {weekLogs.length === 0 ? (
        <EmptyState
          title="이 주에는 기록이 없어요"
          description="집안일을 기록하면 이 주의 공정성 점수가 계산돼요"
          action={
            <Button variant="weak" display="block" onClick={() => navigate('/')}>
              홈에서 체크인하기
            </Button>
          }
        />
      ) : (
        <>
          <SummaryHero
            testId="report-score-hero"
            label="이번 주 공정성 점수"
            value={<CountUp value={result.fairness} unit="점" typography="t1" />}
            caption={
              <Badge size="small" variant="weak" color={GRADE_COLOR[grade]}>
                {grade}
              </Badge>
            }
          />
          <Spacing size={20} />
          <Paragraph.Text typography="t4">구성원별 기여</Paragraph.Text>
          <Spacing size={12} />
          <Card>
            {members.map((m, i) => {
              const share = result.shares[m.id] ?? 0;
              return (
                <div key={m.id} style={{ display: i === 0 ? undefined : 'block', marginTop: i === 0 ? 0 : 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Paragraph.Text typography="st11">
                      {m.emoji} {m.name}
                    </Paragraph.Text>
                    <Paragraph.Text typography="st11">
                      {Math.round(share * 100)}% · 목표 {Math.round(m.targetShare * 100)}%
                    </Paragraph.Text>
                  </div>
                  <Spacing size={8} />
                  <MiniBar ratio={share} />
                </div>
              );
            })}
          </Card>
        </>
      )}
      <Spacing size={80} />
    </ScreenScaffold>
  );
}
