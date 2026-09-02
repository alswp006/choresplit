/**
 * 미이행 집계 & 정산 제안 순수 함수.
 * localStorage 접근 없음 — 입력을 받아 값을 반환하는 순수 함수만 존재한다.
 */

import type {
  ChoreTask,
  ChoreLog,
  Member,
  Weekday,
  UnfulfilledItem,
  FineSummary,
} from "@/lib/types";
import { weekRange, isFutureDate } from "@/domain/date";
import type { Task, CheckinLog, Member as ContractMember } from "@/lib/contract";

/** dateKey(YYYY-MM-DD)의 요일 번호 (0=일 .. 6=토, getUTCDay()와 동일) */
function weekdayNumber(dateKey: string): Weekday {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

/** weekKey의 각 날짜에 대해, 담당자가 있고 archived되지 않은 항목 중 로그가 없는 건을 집계 */
export function calcUnfulfilled(
  tasks: ChoreTask[],
  logs: ChoreLog[],
  members: Member[],
  weekKey: string
): { items: UnfulfilledItem[]; hasUnassignedFineTask: boolean } {
  const { days } = weekRange(weekKey);
  const items: UnfulfilledItem[] = [];

  for (const task of tasks) {
    if (task.archived) continue;
    if (task.assigneeId === null) continue;

    for (const date of days) {
      if (isFutureDate(date)) continue;
      if (!task.repeatDays.includes(weekdayNumber(date))) continue;

      const hasLog = logs.some(
        (log) =>
          log.date === date &&
          log.taskId === task.id &&
          log.memberId === task.assigneeId
      );
      if (hasLog) continue;

      items.push({
        date,
        taskId: task.id,
        taskName: task.name,
        memberId: task.assigneeId,
        fineAmount: task.fineAmount,
      });
    }
  }

  const hasUnassignedFineTask = tasks.some(
    (t) => !t.archived && t.assigneeId === null && t.fineAmount > 0
  );

  return { items, hasUnassignedFineTask };
}

/** 미이행 항목을 구성원별 벌금 합계로 집계 */
export function calcFines(
  unfulfilled: UnfulfilledItem[],
  members: Member[]
): FineSummary[] {
  const totals = new Map<string, { fineAmount: number; unfulfilledCount: number }>();
  for (const item of unfulfilled) {
    const entry = totals.get(item.memberId) ?? { fineAmount: 0, unfulfilledCount: 0 };
    entry.fineAmount += item.fineAmount;
    entry.unfulfilledCount += 1;
    totals.set(item.memberId, entry);
  }

  const knownIds = members.map((m) => m.id);
  const extraIds = [...totals.keys()].filter((id) => !knownIds.includes(id));

  return [...knownIds, ...extraIds]
    .filter((id) => totals.has(id))
    .map((id) => ({ memberId: id, ...totals.get(id)! }));
}

/** 구성원 수에 따른 정산 제안: 2인은 transfer/none, 3인 이상은 listOnly */
export function calcSettlement(
  fines: FineSummary[],
  members: Member[]
):
  | { type: "transfer"; from: string; to: string; amount: number }
  | { type: "none" }
  | { type: "listOnly" } {
  if (members.length >= 3) {
    return { type: "listOnly" };
  }
  if (members.length < 2) {
    return { type: "none" };
  }

  const amountOf = (memberId: string): number =>
    fines.find((f) => f.memberId === memberId)?.fineAmount ?? 0;

  const [a, b] = members;
  const net = amountOf(a.id) - amountOf(b.id);

  if (net === 0) {
    return { type: "none" };
  }
  return net > 0
    ? { type: "transfer", from: a.id, to: b.id, amount: net }
    : { type: "transfer", from: b.id, to: a.id, amount: -net };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 항목 빈도(frequency) 기준 기대 수행 횟수 — daily는 경과일수, weekly는 경과 주수 */
function expectedOccurrences(task: Task, now: number): number {
  const end = task.archivedAt ?? now;
  const elapsedDays = Math.max(0, Math.floor((end - task.createdAt) / MS_PER_DAY) + 1);
  return task.frequency === "daily" ? elapsedDays : Math.max(1, Math.ceil(elapsedDays / 7));
}

/**
 * 미이행으로 인한 벌금 계산 (계약: 패킷 0005).
 * 담당 항목별 기대 수행 횟수(빈도 기반) 대비 실제 체크인 부족분에 정액 벌금을 곱해 합산한다.
 */
export function calculateFinesOwed(
  memberId: string,
  checkins: CheckinLog[],
  tasks: Task[],
  finePerMiss: number
): number {
  const now = Date.now();
  let total = 0;
  for (const task of tasks) {
    if (task.assignee !== memberId) continue;
    const expected = expectedOccurrences(task, now);
    const actual = checkins.filter(
      (c) => c.taskId === task.id && c.memberId === memberId
    ).length;
    total += Math.max(0, expected - actual) * finePerMiss;
  }
  return total;
}

const DEFAULT_FINE_PER_MISS = 1000;

/**
 * 정산 제안 생성 (계약: 패킷 0005).
 * 구성원별 벌금(calculateFinesOwed)을 평균과 비교해 초과분(지불자)과 부족분(수령자)을
 * 그리디로 매칭, 최소 건수의 송금 제안 목록을 만든다.
 */
export function generateSettlement(
  members: ContractMember[],
  checkins: CheckinLog[],
  tasks: Task[]
): { from: string; to: string; amount: number }[] {
  if (members.length < 2) return [];

  const fines = members.map((m) => ({
    id: m.id,
    fine: calculateFinesOwed(m.id, checkins, tasks, DEFAULT_FINE_PER_MISS),
  }));
  const avg = fines.reduce((sum, f) => sum + f.fine, 0) / fines.length;

  const debtors = fines
    .map((f) => ({ id: f.id, balance: f.fine - avg }))
    .filter((f) => f.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const creditors = fines
    .map((f) => ({ id: f.id, balance: avg - f.fine }))
    .filter((f) => f.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const transfers: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.round(Math.min(debtor.balance, creditor.balance));
    if (amount > 0) {
      transfers.push({ from: debtor.id, to: creditor.id, amount });
    }
    debtor.balance -= amount;
    creditor.balance -= amount;
    if (debtor.balance <= 1e-6) i++;
    if (creditor.balance <= 1e-6) j++;
  }
  return transfers;
}
