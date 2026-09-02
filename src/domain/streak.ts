/**
 * 스트릭(연속 수행 일수) 계산 순수 함수.
 * localStorage 접근 없음 — 입력을 받아 값을 반환하는 순수 함수만 존재한다.
 */

import type { ChoreLog, StreakResult } from "@/lib/types";
import type { CheckinLog, Task } from "@/lib/contract";
import { daysBetween, isFutureDate, todayKST } from "@/domain/date";

/** 7일/30일 연속 달성 배지 (그 외 null) */
function badgeOf(streakDays: number): string | null {
  if (streakDays >= 30) return "30일 연속 🏆";
  if (streakDays >= 7) return "7일 연속 달성 🔥";
  return null;
}

/** dateKey(YYYY-MM-DD) 하루 전 dateKey (UTC 자정 앵커 기준 — 로컬 타임존 무관) */
function dayBefore(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000;
  const dt = new Date(ms);
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * 특정 구성원의 오늘(todayKey) 기준 연속 수행 일수.
 * 미래 로그는 제외하고, 날짜별 중복 로그는 하루로만 센다.
 * 마지막 로그가 todayKey 기준 이틀 이상 전이면 streakDays===0.
 */
export function calcStreak(
  logs: ChoreLog[],
  memberId: string,
  todayKey: string
): StreakResult & { badge: string | null } {
  const dateKeys = new Set(
    logs
      .filter((log) => log.memberId === memberId && !isFutureDate(log.date) && log.date <= todayKey)
      .map((log) => log.date)
  );

  if (dateKeys.size === 0) {
    return { memberId, streakDays: 0, lastCheckinDate: null, badge: null };
  }

  const lastCheckinDate = [...dateKeys].sort().at(-1)!;

  if (daysBetween(lastCheckinDate, todayKey) > 1) {
    return { memberId, streakDays: 0, lastCheckinDate, badge: null };
  }

  let streakDays = 0;
  let cursor = lastCheckinDate;
  while (dateKeys.has(cursor)) {
    streakDays += 1;
    cursor = dayBefore(cursor);
  }

  return { memberId, streakDays, lastCheckinDate, badge: badgeOf(streakDays) };
}

/**
 * 연속 완료 일수 (계약: 패킷 0006).
 * date(기본 현재 시각) 기준 오늘 날짜 키로 calcStreak를 호출해 streakDays만 반환한다.
 */
export function calculateStreak(
  memberId: string,
  checkins: CheckinLog[],
  tasks: Task[],
  date?: Date
): number {
  const todayKey = date ? date.toISOString().slice(0, 10) : todayKST();
  const relevantTaskIds = new Set(tasks.map((t) => t.id));
  const logs: ChoreLog[] = checkins
    .filter((c) => relevantTaskIds.has(c.taskId))
    .map((c) => ({
      id: c.id,
      date: c.date,
      taskId: c.taskId,
      memberId: c.memberId,
      weight: 2,
      createdAt: c.completedAt,
    }));
  return calcStreak(logs, memberId, todayKey).streakDays;
}
