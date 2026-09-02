/**
 * Streak & Ranking Calculation + Reminder Logic (Packet 0005)
 *
 * Pure calculation functions for:
 * - getCurrentStreak(state, today): current consecutive checkin streak for me
 * - getBestStreak(state): longest consecutive streak in history
 * - getRanking(state, weekStart): weekly ranking by weightedScore
 * - shouldShowReminder(state, now): reminder display logic (immutable)
 */

import type { ChoreSplitState, MemberWeekStat } from "@/lib/types";

/**
 * AC-1, AC-2: Get current consecutive checkin streak for "me" (isMe=true member)
 * Counts consecutive days backwards from today, stopping at first gap.
 * If today has no checkin, counts up to yesterday.
 * Returns 0 if no consecutive streak exists.
 */
export function getCurrentStreak(state: ChoreSplitState, today: string): number {
  // TODO: implement
  return 0;
}

/**
 * AC-3: Get longest consecutive checkin streak in history for "me"
 * Returns 0 if no checkins exist.
 */
export function getBestStreak(state: ChoreSplitState): number {
  // TODO: implement
  return 0;
}

/**
 * AC-4: Get weekly ranking sorted by weightedScore desc, then memberName asc
 * Only includes checkins within [weekStart, weekStart+6 days]
 * Returns empty array if no checkins in the week.
 */
export function getRanking(
  state: ChoreSplitState,
  weekStart: string
): MemberWeekStat[] {
  // TODO: implement
  return [];
}

/**
 * AC-5: Determine if reminder should be shown
 * Logic:
 * - reminderEnabled must be true
 * - No my checkins today
 * - Current hour >= reminderHour
 * - lastReminderShownDate != today
 *
 * CRITICAL: Does NOT mutate state
 */
export function shouldShowReminder(
  state: ChoreSplitState,
  now: Date
): boolean {
  // TODO: implement
  return false;
}
