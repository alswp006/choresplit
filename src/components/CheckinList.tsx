import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Asset, Button, Chip, ChipItem, ListRow, Paragraph, Spacing, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { todayKST } from "@/domain/date";
import type { ChoreTask } from "@/lib/types";

const AD_GROUP_ID = (import.meta.env.VITE_TOSS_AD_GROUP_ID as string | undefined) ?? "";

function difficultyLabel(task: ChoreTask): string {
  return `${"★".repeat(task.difficulty)}${"☆".repeat(3 - task.difficulty)}`;
}

/**
 * 홈 체크인 리스트 — 미보관 항목을 행 전체 탭으로 멱등 토글, 빈 상태, 배너 광고.
 *
 * Pre-built 조립: Card + ListRow(행 전체가 탭 영역) + StateView.EmptyState + AdSlot.
 * checked 여부는 store.logs에서 파생만 하고 로컬로 낙관적 반영하지 않는다 —
 * 저장 실패 시 store.logs가 갱신되지 않아 자연히 이전 상태로 남는다(별도 롤백 불필요).
 */
export function CheckinList() {
  const navigate = useNavigate();
  const { household, tasks, logs, settings, toast: storeToast, toggleLog } = useAppStore();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const today = todayKST();
  const memberId = settings.activeMemberId ?? household?.members[0]?.id ?? null;
  const visibleTasks = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);

  useEffect(() => {
    if (storeToast) setToastMsg(storeToast);
  }, [storeToast]);

  function isChecked(taskId: string): boolean {
    if (!memberId) return false;
    const id = `lg_${today}_${taskId}_${memberId}`;
    return logs.some((l) => l.id === id);
  }

  function handleToggle(task: ChoreTask) {
    if (!memberId) return;
    const wasChecked = isChecked(task.id);
    toggleLog(today, task.id, memberId);
    try {
      generateHapticFeedback({ type: wasChecked ? "tickWeak" : "success" });
    } catch {
      /* WebView 밖 — 무시 */
    }
    setToastMsg(wasChecked ? "기록을 취소했어요" : `${task.name} 완료!`);
  }

  if (visibleTasks.length === 0) {
    return (
      <EmptyState
        testId="home-empty"
        icon={<Asset.ContentIcon name="iconEmptyRegular" alt="빈 상태" />}
        title="집안일을 먼저 등록해주세요"
        action={
          <Button variant="weak" display="block" onClick={() => navigate("/tasks")}>
            항목 등록하기
          </Button>
        }
      />
    );
  }

  const allDone = visibleTasks.every((t) => isChecked(t.id));

  return (
    <>
      <Paragraph.Text typography="t4">할 일</Paragraph.Text>
      <Spacing size={12} />
      <Card testId="checkin-card">
        {visibleTasks.map((task) => {
          const done = isChecked(task.id);
          return (
            <ListRow
              key={task.id}
              data-testid="checkin-row"
              onClick={() => handleToggle(task)}
              style={{ minHeight: 56 }}
              left={<Paragraph.Text typography="t3">{task.emoji}</Paragraph.Text>}
              contents={<ListRow.Texts type="2RowTypeA" top={task.name} bottom={difficultyLabel(task)} />}
              right={
                <Chip>
                  <ChipItem selected={done}>{done ? "완료" : "체크"}</ChipItem>
                </Chip>
              }
            />
          );
        })}
      </Card>
      {allDone ? (
        <>
          <Spacing size={12} />
          <Paragraph.Text typography="st11" color="secondary">
            오늘 할 일 다 했어요 🎉
          </Paragraph.Text>
        </>
      ) : null}
      <Spacing size={16} />
      <AdSlot adGroupId={AD_GROUP_ID} />
      <Spacing size={16} />
      <Toast
        open={toastMsg !== null}
        text={toastMsg ?? ""}
        position="bottom"
        onClose={() => setToastMsg(null)}
      />
    </>
  );
}
