/**
 * Streak & Ranking Calculation + Reminder Logic (Packet 0005)
 *
 * Pure calculation functions for:
 * - getStreak(state, memberId, today?): current consecutive checkin streak for a member
 * - getRanking(state, days?): weighted-score ranking over the trailing N days
 * - countTodayCheckIns(state, memberId, today): today's checkin count for a member
 * - shouldShowReminder(settings, now, todayMyCheckInCount): reminder banner display logic
 */

import type { ChoreSplitState, MemberWeekStat, Settings } from "@/lib/types";

function todayKST(): string {
  const kstMs = Date.now() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

function addDaysToDateStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * F8-AC-1, F8-AC-2: Consecutive checkin streak for a member, counted backwards
 * from `today`. If `today` has no checkin, counting starts from yesterday
 * instead (today's missing record does not break the streak).
 */
export function getStreak(
  state: ChoreSplitState,
  memberId: string,
  today: string = todayKST()
): number {
  const dates = new Set(
    state.checkIns.filter((c) => c.memberId === memberId).map((c) => c.date)
  );
  let cursor = dates.has(today) ? today : addDaysToDateStr(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateStr(cursor, -1);
  }
  return streak;
}

/**
 * F8-AC-3: Ranking over the trailing `days` days (today inclusive), sorted by
 * weightedScore desc, then memberName asc. Every member is included even with
 * zero checkins in range.
 */
export function getRanking(
  state: ChoreSplitState,
  days: number = 30
): MemberWeekStat[] {
  const today = todayKST();
  const startDate = addDaysToDateStr(today, -(days - 1));
  const inRange = state.checkIns.filter(
    (c) => c.date >= startDate && c.date <= today
  );

  const byMember = new Map<string, { count: number; weightedScore: number }>();
  for (const m of state.members) {
    byMember.set(m.id, { count: 0, weightedScore: 0 });
  }
  for (const c of inRange) {
    const entry = byMember.get(c.memberId);
    if (!entry) continue;
    entry.count += 1;
    entry.weightedScore += c.weightAtLog;
  }

  const totalWeighted = inRange.reduce((sum, c) => sum + c.weightAtLog, 0);

  const stats: MemberWeekStat[] = state.members.map((m) => {
    const entry = byMember.get(m.id)!;
    return {
      memberId: m.id,
      memberName: m.name,
      count: entry.count,
      weightedScore: entry.weightedScore,
      sharePct:
        totalWeighted === 0
          ? 0
          : Math.round((entry.weightedScore / totalWeighted) * 1000) / 10,
    };
  });

  stats.sort(
    (a, b) =>
      b.weightedScore - a.weightedScore || a.memberName.localeCompare(b.memberName)
  );
  return stats;
}

/** Today's checkin count for a member (used to decide reminder visibility). */
export function countTodayCheckIns(
  state: ChoreSplitState,
  memberId: string,
  today: string
): number {
  return state.checkIns.filter(
    (c) => c.memberId === memberId && c.date === today
  ).length;
}

/**
 * F8-AC-4, F8-AC-5: Whether the in-app reminder banner should be shown.
 * UTC-based "today"/hour so results don't depend on the runner's local
 * timezone (matches the UTC date handling used throughout this module).
 */
export function shouldShowReminder(
  settings: Settings,
  now: Date,
  todayMyCheckInCount: number
): boolean {
  if (!settings.reminderEnabled) return false;
  if (todayMyCheckInCount > 0) return false;
  if (now.getUTCHours() < settings.reminderHour) return false;

  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getUTCDate()).padStart(2, "0")}`;
  if (settings.lastReminderShownDate === today) return false;

  return true;
}
