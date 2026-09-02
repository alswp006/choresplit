/**
 * 주간 랭킹 계산 순수 함수.
 * localStorage 접근 없음 — 입력을 받아 값을 반환하는 순수 함수만 존재한다.
 */

import type { ChoreLog, Member, RankRow } from "@/lib/types";
import type { CheckinLog, Task, Member as ContractMember } from "@/lib/contract";
import { isFutureDate, todayKST, weekKeyOf } from "@/domain/date";

/**
 * 특정 주(weekKey)의 구성원별 랭킹.
 * 정렬: weight DESC → logCount DESC → member.createdAt ASC.
 * 미래 날짜 로그는 제외. 로그가 없는 구성원도 weight=0으로 포함된다.
 */
export function calcRanking(
  logs: ChoreLog[],
  members: Member[],
  weekKey: string
): (RankRow & { ratio: number; isTop: boolean })[] {
  const relevant = logs.filter((log) => !isFutureDate(log.date) && weekKeyOf(log.date) === weekKey);

  const totals = new Map<string, { weight: number; logCount: number }>();
  for (const member of members) {
    totals.set(member.id, { weight: 0, logCount: 0 });
  }
  for (const log of relevant) {
    const entry = totals.get(log.memberId) ?? { weight: 0, logCount: 0 };
    entry.weight += log.weight;
    entry.logCount += 1;
    totals.set(log.memberId, entry);
  }

  const createdAtOf = new Map(members.map((m) => [m.id, m.createdAt]));

  const rows = [...totals.entries()].map(([memberId, { weight, logCount }]) => ({
    memberId,
    weight,
    logCount,
  }));

  rows.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.logCount !== a.logCount) return b.logCount - a.logCount;
    return (createdAtOf.get(a.memberId) ?? 0) - (createdAtOf.get(b.memberId) ?? 0);
  });

  const maxWeight = rows.length > 0 ? rows[0].weight : 0;

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    ratio: maxWeight === 0 ? 0 : Math.round((row.weight / maxWeight) * 100) / 100,
    isTop: index === 0 && row.weight > 0,
  }));
}

/**
 * 주간 랭킹 계산 (계약: 패킷 0006).
 * tasks에 속한 checkins만 대상으로 현재 주(weekKey)의 순위를 계산한다.
 */
export function getWeeklyRankings(
  members: ContractMember[],
  checkins: CheckinLog[],
  tasks: Task[]
): { memberId: string; rank: number; score: number }[] {
  const taskIds = new Set(tasks.map((t) => t.id));
  const weekKey = weekKeyOf(todayKST());

  const logs: ChoreLog[] = checkins
    .filter((c) => taskIds.has(c.taskId))
    .map((c) => ({
      id: c.id,
      date: c.date,
      taskId: c.taskId,
      memberId: c.memberId,
      weight: 2,
      createdAt: c.completedAt,
    }));

  const domainMembers: Member[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    emoji: "",
    targetShare: m.targetRatio ?? 0,
    createdAt: m.joinedAt,
  }));

  return calcRanking(logs, domainMembers, weekKey).map((row) => ({
    memberId: row.memberId,
    rank: row.rank,
    score: row.weight,
  }));
}
